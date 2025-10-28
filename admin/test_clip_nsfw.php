<?php
/**
 * CLIP NSFW Integration Test Script
 * Test the complete CLIP NSFW system integration
 */

require_once __DIR__ . '/php/ClipNSFWDescriber.php';
require_once __DIR__ . '/../services/EnhancedImageModerationService.php';

class CLIPNSFWTester {
    private ClipNSFWDescriber $clipDescriber;
    private EnhancedImageModerationService $moderationService;
    
    public function __construct() {
        // Test configuration
        $config = [
            'python_env' => '/Users/programmer/Projects/phoenix4ge/admin/python/clip_env/bin/python',
            'timeout' => 30,
            'debug' => true,
            'cache_enabled' => false // Disable cache for testing
        ];
        
        try {
            $this->clipDescriber = new ClipNSFWDescriber($config);
            $this->moderationService = new EnhancedImageModerationService($config);
            
            echo "✅ Services initialized successfully\n";
        } catch (Exception $e) {
            echo "❌ Failed to initialize services: " . $e->getMessage() . "\n";
            exit(1);
        }
    }
    
    public function runTests(): bool {
        echo "🧪 Starting CLIP NSFW Integration Tests\n";
        echo str_repeat("=", 50) . "\n";
        
        $allPassed = true;
        
        // Test 1: Availability Test
        echo "\n📋 Test 1: System Availability\n";
        $allPassed &= $this->testAvailability();
        
        // Test 2: Categories Test
        echo "\n📋 Test 2: Categories Loading\n";
        $allPassed &= $this->testCategories();
        
        // Test 3: Create test image
        echo "\n📋 Test 3: Sample Image Processing\n";
        $testImagePath = $this->createTestImage();
        if ($testImagePath) {
            $allPassed &= $this->testImageProcessing($testImagePath);
            $allPassed &= $this->testEnhancedModeration($testImagePath);
            
            // Cleanup
            unlink($testImagePath);
        } else {
            echo "❌ Failed to create test image\n";
            $allPassed = false;
        }
        
        // Test 4: Performance Test
        echo "\n📋 Test 4: Performance Metrics\n";
        $allPassed &= $this->testPerformance();
        
        // Test 5: Error Handling
        echo "\n📋 Test 5: Error Handling\n";
        $allPassed &= $this->testErrorHandling();
        
        echo "\n" . str_repeat("=", 50) . "\n";
        if ($allPassed) {
            echo "🎉 All tests passed! CLIP NSFW system is working correctly.\n";
        } else {
            echo "❌ Some tests failed. Please check the output above.\n";
        }
        
        return $allPassed;
    }
    
    private function testAvailability(): bool {
        try {
            $availability = $this->clipDescriber->testAvailability();
            
            if ($availability['available']) {
                echo "✅ CLIP processor is available\n";
                echo "   - Response time: " . round($availability['response_time'], 3) . "s\n";
                echo "   - Categories: " . ($availability['categories_count'] ?? 'unknown') . "\n";
                echo "   - Python: " . $availability['python_env'] . "\n";
                echo "   - Cache: " . ($availability['cache_enabled'] ? 'enabled' : 'disabled') . "\n";
                return true;
            } else {
                echo "❌ CLIP processor not available: " . ($availability['error'] ?? 'unknown error') . "\n";
                return false;
            }
        } catch (Exception $e) {
            echo "❌ Availability test failed: " . $e->getMessage() . "\n";
            return false;
        }
    }
    
    private function testCategories(): bool {
        try {
            $categories = $this->clipDescriber->getCategories();
            
            if ($categories['success']) {
                $total = $categories['total_descriptions'] ?? 0;
                $categoryList = $categories['categories'] ?? [];
                
                echo "✅ Categories loaded successfully\n";
                echo "   - Total descriptions: {$total}\n";
                echo "   - Categories: " . count($categoryList) . "\n";
                
                // Show category breakdown
                foreach (array_slice($categoryList, 0, 5) as $category => $count) {
                    echo "     • {$category}: {$count} descriptions\n";
                }
                
                if (count($categoryList) > 5) {
                    echo "     • ... and " . (count($categoryList) - 5) . " more\n";
                }
                
                return $total > 0;
            } else {
                echo "❌ Failed to load categories: " . ($categories['error'] ?? 'unknown error') . "\n";
                return false;
            }
        } catch (Exception $e) {
            echo "❌ Categories test failed: " . $e->getMessage() . "\n";
            return false;
        }
    }
    
    private function createTestImage(): ?string {
        // Create a simple test image (solid color)
        $width = 224;
        $height = 224;
        
        $image = imagecreatetruecolor($width, $height);
        if (!$image) {
            echo "❌ Failed to create test image\n";
            return null;
        }
        
        // Fill with a color
        $color = imagecolorallocate($image, 128, 128, 128);
        imagefill($image, 0, 0, $color);
        
        // Add some text
        $textColor = imagecolorallocate($image, 255, 255, 255);
        imagestring($image, 5, 50, 100, "TEST IMAGE", $textColor);
        
        $testPath = sys_get_temp_dir() . '/clip_test_' . uniqid() . '.jpg';
        
        if (imagejpeg($image, $testPath, 90)) {
            imagedestroy($image);
            echo "✅ Test image created: {$testPath}\n";
            return $testPath;
        } else {
            imagedestroy($image);
            echo "❌ Failed to save test image\n";
            return null;
        }
    }
    
    private function testImageProcessing(string $imagePath): bool {
        try {
            $startTime = microtime(true);
            $result = $this->clipDescriber->describeImage($imagePath, 3);
            $processingTime = microtime(true) - $startTime;
            
            if ($result['success']) {
                echo "✅ Image processing successful\n";
                echo "   - Processing time: " . round($processingTime, 3) . "s\n";
                echo "   - Results count: " . count($result['results'] ?? []) . "\n";
                
                // Show top match
                if (!empty($result['results'])) {
                    $topMatch = $result['results'][0];
                    echo "   - Top match: \"{$topMatch['description']}\"\n";
                    echo "   - Confidence: " . round($topMatch['confidence'], 3) . "\n";
                    echo "   - Category: {$topMatch['category']}\n";
                    echo "   - Above threshold: " . ($topMatch['above_threshold'] ? 'yes' : 'no') . "\n";
                }
                
                return true;
            } else {
                echo "❌ Image processing failed: " . ($result['error'] ?? 'unknown error') . "\n";
                return false;
            }
        } catch (Exception $e) {
            echo "❌ Image processing test failed: " . $e->getMessage() . "\n";
            return false;
        }
    }
    
    private function testEnhancedModeration(string $imagePath): bool {
        try {
            $startTime = microtime(true);
            $result = $this->moderationService->moderateImage($imagePath);
            $processingTime = microtime(true) - $startTime;
            
            echo "✅ Enhanced moderation test\n";
            echo "   - Processing time: " . round($processingTime, 3) . "s\n";
            echo "   - CLIP available: " . ($result['clip_available'] ? 'yes' : 'no') . "\n";
            echo "   - Enhancement used: " . ($result['enhancement_used'] ? 'yes' : 'no') . "\n";
            
            if ($result['enhancement_used']) {
                echo "   - NSFW description: \"{$result['nsfw_description']}\"\n";
                echo "   - NSFW confidence: " . round($result['nsfw_confidence'], 3) . "\n";
                echo "   - NSFW category: {$result['nsfw_category']}\n";
                echo "   - Enhanced description: \"{$result['enhanced_description']}\"\n";
            }
            
            if (isset($result['clip_metadata'])) {
                $meta = $result['clip_metadata'];
                echo "   - CLIP processing time: " . round($meta['processing_time'], 3) . "s\n";
                echo "   - Total matches: {$meta['total_matches']}\n";
                echo "   - Above threshold: {$meta['above_threshold_matches']}\n";
            }
            
            return true;
        } catch (Exception $e) {
            echo "❌ Enhanced moderation test failed: " . $e->getMessage() . "\n";
            return false;
        }
    }
    
    private function testPerformance(): bool {
        try {
            $status = $this->moderationService->getSystemStatus();
            
            echo "✅ System status retrieved\n";
            echo "   - CLIP enabled: " . ($status['clip_enabled'] ? 'yes' : 'no') . "\n";
            echo "   - Parent service: " . ($status['parent_service_available'] ? 'available' : 'missing') . "\n";
            
            $metrics = $status['performance_metrics'] ?? [];
            if (!empty($metrics)) {
                echo "   - Total processed: {$metrics['total_processed']}\n";
                echo "   - Average time: {$metrics['average_processing_time']}s\n";
                echo "   - Enhancement rate: {$metrics['enhancement_rate']}%\n";
                echo "   - Cache hit rate: {$metrics['cache_hit_rate']}%\n";
            }
            
            if (isset($status['cache_stats'])) {
                $cache = $status['cache_stats'];
                echo "   - Cache enabled: " . ($cache['cache_enabled'] ? 'yes' : 'no') . "\n";
                if ($cache['cache_enabled']) {
                    echo "   - Cached images: " . ($cache['cached_images'] ?? 0) . "\n";
                }
            }
            
            return true;
        } catch (Exception $e) {
            echo "❌ Performance test failed: " . $e->getMessage() . "\n";
            return false;
        }
    }
    
    private function testErrorHandling(): bool {
        try {
            // Test with non-existent image
            $result = $this->clipDescriber->describeImage('/nonexistent/image.jpg');
            
            if (!$result['success']) {
                echo "✅ Error handling works correctly for missing files\n";
                echo "   - Error: {$result['error']}\n";
            } else {
                echo "⚠️  Expected error for missing file, but got success\n";
                return false;
            }
            
            // Test enhanced moderation error handling
            $result = $this->moderationService->moderateImage('/nonexistent/image.jpg');
            echo "✅ Enhanced moderation error handling works\n";
            echo "   - Success: " . ($result['success'] ? 'true' : 'false') . "\n";
            echo "   - Has error info: " . (isset($result['error']) ? 'yes' : 'no') . "\n";
            
            return true;
        } catch (Exception $e) {
            echo "❌ Error handling test failed: " . $e->getMessage() . "\n";
            return false;
        }
    }
}

// Run the tests
try {
    $tester = new CLIPNSFWTester();
    $success = $tester->runTests();
    
    exit($success ? 0 : 1);
} catch (Exception $e) {
    echo "❌ Test runner failed: " . $e->getMessage() . "\n";
    exit(1);
}