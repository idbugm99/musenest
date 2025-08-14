<?php
/**
 * Enhanced Image Moderation Service with CLIP NSFW Description
 * Extends existing ImageModerationService with explicit content descriptions
 */

require_once __DIR__ . '/../admin/php/ClipNSFWDescriber.php';

class EnhancedImageModerationService extends ImageModerationService {
    private ClipNSFWDescriber $clipDescriber;
    private array $clipConfig;
    private bool $clipEnabled;
    private array $performanceMetrics;
    
    public function __construct(array $config = []) {
        parent::__construct();
        
        $this->clipConfig = array_merge([
            'enabled' => true,
            'fallback_on_error' => true,
            'min_confidence' => 0.25,
            'max_processing_time' => 30,
            'cache_enabled' => true,
            'debug_mode' => false,
            'python_env' => '/usr/bin/python3'
        ], $config);
        
        $this->clipEnabled = $this->clipConfig['enabled'];
        $this->performanceMetrics = [];
        
        // Initialize CLIP describer if enabled
        if ($this->clipEnabled) {
            try {
                $this->clipDescriber = new ClipNSFWDescriber([
                    'timeout' => $this->clipConfig['max_processing_time'],
                    'cache_enabled' => $this->clipConfig['cache_enabled'],
                    'debug' => $this->clipConfig['debug_mode'],
                    'python_env' => $this->clipConfig['python_env']
                ]);
                
                // Test availability
                $availability = $this->clipDescriber->testAvailability();
                if (!$availability['available']) {
                    error_log("CLIP NSFW not available: " . ($availability['error'] ?? 'Unknown error'));
                    if (!$this->clipConfig['fallback_on_error']) {
                        throw new RuntimeException("CLIP NSFW processor not available");
                    }
                    $this->clipEnabled = false;
                }
            } catch (Exception $e) {
                error_log("Failed to initialize CLIP NSFW: " . $e->getMessage());
                if (!$this->clipConfig['fallback_on_error']) {
                    throw $e;
                }
                $this->clipEnabled = false;
            }
        }
    }
    
    /**
     * Enhanced image moderation with NSFW descriptions
     *
     * @param string $imagePath Path to image file
     * @param array $options Additional options
     * @return array Enhanced moderation result
     */
    public function moderateImage(string $imagePath, array $options = []): array {
        $startTime = microtime(true);
        
        // Get original BLIP moderation result
        $blipResult = parent::moderateImage($imagePath);
        
        // Initialize enhanced result
        $result = $blipResult;
        $result['nsfw_description'] = null;
        $result['nsfw_confidence'] = 0;
        $result['nsfw_category'] = null;
        $result['enhancement_used'] = false;
        $result['clip_available'] = $this->clipEnabled;
        
        // Add CLIP NSFW description if enabled and image exists
        if ($this->clipEnabled && file_exists($imagePath)) {
            try {
                $clipResult = $this->getClipDescription($imagePath, $options);
                
                if ($clipResult['success'] && !empty($clipResult['results'])) {
                    $bestMatch = $this->findBestMatch($clipResult['results']);
                    
                    if ($bestMatch && $bestMatch['confidence'] >= $this->clipConfig['min_confidence']) {
                        $result['nsfw_description'] = $bestMatch['description'];
                        $result['nsfw_confidence'] = $bestMatch['confidence'];
                        $result['nsfw_category'] = $bestMatch['category'];
                        $result['enhancement_used'] = true;
                        
                        // Create enhanced description combining BLIP and CLIP
                        $result['enhanced_description'] = $this->combineDescriptions(
                            $blipResult['description'] ?? '',
                            $bestMatch['description'],
                            $bestMatch['confidence']
                        );
                        
                        // Update moderation status based on NSFW content
                        $result = $this->updateModerationStatus($result, $bestMatch);
                    }
                }
                
                // Add CLIP metadata
                $result['clip_metadata'] = [
                    'processing_time' => $clipResult['execution_time'] ?? 0,
                    'cached' => $clipResult['cached'] ?? false,
                    'total_matches' => count($clipResult['results'] ?? []),
                    'above_threshold_matches' => count(array_filter(
                        $clipResult['results'] ?? [],
                        fn($r) => $r['above_threshold'] ?? false
                    ))
                ];
                
            } catch (Exception $e) {
                error_log("CLIP NSFW processing failed: " . $e->getMessage());
                
                $result['clip_error'] = $e->getMessage();
                
                // If fallback is disabled, include error in main result
                if (!$this->clipConfig['fallback_on_error']) {
                    $result['errors'][] = "NSFW description failed: " . $e->getMessage();
                }
            }
        }
        
        // Record performance metrics
        $totalTime = microtime(true) - $startTime;
        $this->recordPerformanceMetrics($imagePath, $totalTime, $result);
        
        return $result;
    }
    
    /**
     * Batch process multiple images with enhanced moderation
     *
     * @param array $imagePaths Array of image file paths
     * @param array $options Processing options
     * @return array Batch results
     */
    public function moderateBatch(array $imagePaths, array $options = []): array {
        $startTime = microtime(true);
        
        // Filter existing images
        $validImages = array_filter($imagePaths, 'file_exists');
        
        // Process with parent service
        $blipResults = [];
        foreach ($validImages as $imagePath) {
            $blipResults[$imagePath] = parent::moderateImage($imagePath);
        }
        
        // Enhance with CLIP descriptions if enabled
        $enhancedResults = [];
        
        if ($this->clipEnabled && !empty($validImages)) {
            try {
                // Use batch processing for efficiency
                $clipBatchResult = $this->clipDescriber->describeBatch($validImages);
                
                if ($clipBatchResult['success']) {
                    foreach ($validImages as $imagePath) {
                        $blipResult = $blipResults[$imagePath] ?? [];
                        $clipResult = $clipBatchResult['batch_results'][$imagePath] ?? null;
                        
                        $enhanced = $this->combineResults($blipResult, $clipResult);
                        $enhancedResults[$imagePath] = $enhanced;
                    }
                } else {
                    // Fallback to BLIP-only results
                    $enhancedResults = $blipResults;
                }
                
            } catch (Exception $e) {
                error_log("Batch CLIP NSFW processing failed: " . $e->getMessage());
                $enhancedResults = $blipResults;
            }
        } else {
            $enhancedResults = $blipResults;
        }
        
        // Add results for invalid paths
        foreach ($imagePaths as $path) {
            if (!file_exists($path)) {
                $enhancedResults[$path] = [
                    'success' => false,
                    'error' => 'Image file not found',
                    'description' => null,
                    'nsfw_description' => null
                ];
            }
        }
        
        $totalTime = microtime(true) - $startTime;
        
        return [
            'success' => true,
            'results' => $enhancedResults,
            'summary' => [
                'total_requested' => count($imagePaths),
                'valid_images' => count($validImages),
                'enhanced_count' => count(array_filter($enhancedResults, fn($r) => $r['enhancement_used'] ?? false)),
                'processing_time' => $totalTime,
                'clip_enabled' => $this->clipEnabled
            ]
        ];
    }
    
    /**
     * Get NSFW categories and statistics
     *
     * @return array Categories information
     */
    public function getNSFWCategories(): array {
        if (!$this->clipEnabled) {
            return [
                'success' => false,
                'error' => 'CLIP NSFW not enabled',
                'categories' => []
            ];
        }
        
        try {
            return $this->clipDescriber->getCategories();
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'categories' => []
            ];
        }
    }
    
    /**
     * Get system status and performance metrics
     *
     * @return array System status
     */
    public function getSystemStatus(): array {
        $status = [
            'clip_enabled' => $this->clipEnabled,
            'parent_service_available' => method_exists(get_parent_class(), 'moderateImage'),
            'performance_metrics' => $this->getPerformanceMetrics()
        ];
        
        if ($this->clipEnabled) {
            $status['clip_availability'] = $this->clipDescriber->testAvailability();
            $status['cache_stats'] = $this->clipDescriber->getCacheStats();
        }
        
        return $status;
    }
    
    private function getClipDescription(string $imagePath, array $options): array {
        $topK = $options['top_k'] ?? 5;
        return $this->clipDescriber->describeImage($imagePath, $topK);
    }
    
    private function findBestMatch(array $results): ?array {
        if (empty($results)) {
            return null;
        }
        
        // Find highest confidence match that's above threshold
        $bestMatch = null;
        $highestConfidence = 0;
        
        foreach ($results as $result) {
            if (($result['above_threshold'] ?? false) && 
                $result['confidence'] > $highestConfidence) {
                $bestMatch = $result;
                $highestConfidence = $result['confidence'];
            }
        }
        
        // If no matches above threshold, return highest confidence anyway
        if ($bestMatch === null) {
            $bestMatch = $results[0]; // Results are ordered by confidence
        }
        
        return $bestMatch;
    }
    
    private function combineDescriptions(string $blipDesc, string $nsfwDesc, float $confidence): string {
        if (empty($blipDesc)) {
            return $nsfwDesc;
        }
        
        if (empty($nsfwDesc)) {
            return $blipDesc;
        }
        
        // Format based on confidence level
        if ($confidence >= 0.7) {
            return "{$blipDesc} | EXPLICIT: {$nsfwDesc}";
        } elseif ($confidence >= 0.4) {
            return "{$blipDesc} | LIKELY: {$nsfwDesc}";
        } else {
            return "{$blipDesc} | POSSIBLE: {$nsfwDesc}";
        }
    }
    
    private function updateModerationStatus(array $result, array $nsfwMatch): array {
        $category = $nsfwMatch['category'] ?? '';
        $confidence = $nsfwMatch['confidence'] ?? 0;
        
        // Update moderation status based on NSFW category and confidence
        if ($confidence >= 0.8) {
            // High confidence explicit content
            $result['moderation_status'] = 'flagged';
            $result['moderation_reason'] = 'High confidence explicit content detected';
        } elseif ($confidence >= 0.5) {
            // Medium confidence explicit content
            if (!isset($result['moderation_status']) || $result['moderation_status'] === 'approved') {
                $result['moderation_status'] = 'flagged';
                $result['moderation_reason'] = 'Explicit content detected';
            }
        }
        
        // Add NSFW-specific flags
        $explicitCategories = ['oral_sex', 'penetrative_sex', 'anal_sex', 'explicit_anatomy'];
        if (in_array($category, $explicitCategories) && $confidence >= 0.6) {
            $result['nsfw_explicit'] = true;
            $result['requires_blur'] = true;
        }
        
        return $result;
    }
    
    private function combineResults(array $blipResult, ?array $clipResult): array {
        $result = $blipResult;
        $result['nsfw_description'] = null;
        $result['nsfw_confidence'] = 0;
        $result['nsfw_category'] = null;
        $result['enhancement_used'] = false;
        
        if ($clipResult && ($clipResult['success'] ?? false)) {
            $bestMatch = $this->findBestMatch($clipResult['results'] ?? []);
            
            if ($bestMatch && $bestMatch['confidence'] >= $this->clipConfig['min_confidence']) {
                $result['nsfw_description'] = $bestMatch['description'];
                $result['nsfw_confidence'] = $bestMatch['confidence'];
                $result['nsfw_category'] = $bestMatch['category'];
                $result['enhancement_used'] = true;
                
                $result['enhanced_description'] = $this->combineDescriptions(
                    $blipResult['description'] ?? '',
                    $bestMatch['description'],
                    $bestMatch['confidence']
                );
                
                $result = $this->updateModerationStatus($result, $bestMatch);
            }
        }
        
        return $result;
    }
    
    private function recordPerformanceMetrics(string $imagePath, float $processingTime, array $result): void {
        $this->performanceMetrics[] = [
            'timestamp' => time(),
            'image_path' => basename($imagePath),
            'processing_time' => $processingTime,
            'enhancement_used' => $result['enhancement_used'] ?? false,
            'clip_cached' => $result['clip_metadata']['cached'] ?? false,
            'nsfw_confidence' => $result['nsfw_confidence'] ?? 0,
            'success' => $result['success'] ?? false
        ];
        
        // Keep only last 1000 metrics
        if (count($this->performanceMetrics) > 1000) {
            $this->performanceMetrics = array_slice($this->performanceMetrics, -1000);
        }
    }
    
    private function getPerformanceMetrics(): array {
        if (empty($this->performanceMetrics)) {
            return [
                'total_processed' => 0,
                'average_processing_time' => 0,
                'enhancement_rate' => 0,
                'cache_hit_rate' => 0
            ];
        }
        
        $total = count($this->performanceMetrics);
        $avgTime = array_sum(array_column($this->performanceMetrics, 'processing_time')) / $total;
        $enhanced = count(array_filter($this->performanceMetrics, fn($m) => $m['enhancement_used']));
        $cached = count(array_filter($this->performanceMetrics, fn($m) => $m['clip_cached']));
        
        return [
            'total_processed' => $total,
            'average_processing_time' => round($avgTime, 3),
            'enhancement_rate' => round(($enhanced / $total) * 100, 1),
            'cache_hit_rate' => $enhanced > 0 ? round(($cached / $enhanced) * 100, 1) : 0,
            'recent_metrics' => array_slice($this->performanceMetrics, -10)
        ];
    }
    
    /**
     * Clear CLIP cache
     *
     * @param string|null $imagePath Specific image or all
     * @return bool Success status
     */
    public function clearNSFWCache(string $imagePath = null): bool {
        if (!$this->clipEnabled) {
            return false;
        }
        
        try {
            return $this->clipDescriber->clearCache($imagePath);
        } catch (Exception $e) {
            error_log("Failed to clear NSFW cache: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Test NSFW processing with sample image
     *
     * @param string $imagePath Test image path
     * @return array Test results
     */
    public function testNSFWProcessing(string $imagePath): array {
        if (!file_exists($imagePath)) {
            return [
                'success' => false,
                'error' => 'Test image not found'
            ];
        }
        
        $startTime = microtime(true);
        
        try {
            $result = $this->moderateImage($imagePath, ['test_mode' => true]);
            $processingTime = microtime(true) - $startTime;
            
            return [
                'success' => true,
                'clip_enabled' => $this->clipEnabled,
                'enhancement_used' => $result['enhancement_used'] ?? false,
                'processing_time' => $processingTime,
                'nsfw_description' => $result['nsfw_description'] ?? null,
                'nsfw_confidence' => $result['nsfw_confidence'] ?? 0,
                'nsfw_category' => $result['nsfw_category'] ?? null,
                'enhanced_description' => $result['enhanced_description'] ?? null
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'processing_time' => microtime(true) - $startTime
            ];
        }
    }
}