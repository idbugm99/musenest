<?php
/**
 * CLIP NSFW Image Describer for MuseNest
 * PHP wrapper for CLIP-based explicit content description
 */

class ClipNSFWDescriber {
    private string $pythonScript;
    private string $pythonEnv;
    private int $timeout;
    private bool $debugMode;
    private ?Redis $redis;
    private array $config;
    
    public function __construct(array $config = []) {
        $this->config = array_merge([
            'python_script' => __DIR__ . '/../python/clip_nsfw_processor.py',
            'python_env' => '/usr/bin/python3', // Default system Python
            'timeout' => 30,
            'debug' => false,
            'cache_enabled' => true,
            'cache_ttl' => 604800, // 7 days
            'redis_host' => 'localhost',
            'redis_port' => 6379,
            'redis_db' => 0
        ], $config);
        
        $this->pythonScript = $this->config['python_script'];
        $this->pythonEnv = $this->config['python_env'];
        $this->timeout = $this->config['timeout'];
        $this->debugMode = $this->config['debug'];
        
        // Initialize Redis if caching is enabled
        if ($this->config['cache_enabled']) {
            $this->initializeRedis();
        }
        
        // Validate Python script exists
        if (!file_exists($this->pythonScript)) {
            throw new RuntimeException("CLIP processor script not found: {$this->pythonScript}");
        }
    }
    
    private function initializeRedis(): void {
        try {
            $this->redis = new Redis();
            $this->redis->connect($this->config['redis_host'], $this->config['redis_port']);
            $this->redis->select($this->config['redis_db']);
        } catch (Exception $e) {
            error_log("CLIP NSFW: Redis connection failed: " . $e->getMessage());
            $this->redis = null;
        }
    }
    
    /**
     * Describe a single image using CLIP NSFW processor
     *
     * @param string $imagePath Path to the image file
     * @param int $topK Number of top matches to return
     * @return array Result array with success status and descriptions
     */
    public function describeImage(string $imagePath, int $topK = 5): array {
        if (!file_exists($imagePath)) {
            return [
                'success' => false,
                'error' => 'Image file not found',
                'results' => []
            ];
        }
        
        // Check cache first
        if ($this->redis) {
            $cached = $this->getCachedResult($imagePath);
            if ($cached !== null) {
                return $cached;
            }
        }
        
        // Build command
        $command = $this->buildCommand($imagePath, $topK);
        
        // Execute CLIP processor
        $startTime = microtime(true);
        $output = $this->executeCommand($command);
        $executionTime = microtime(true) - $startTime;
        
        // Parse result
        $result = $this->parseOutput($output);
        
        // Add execution metadata
        if ($result['success']) {
            $result['execution_time'] = $executionTime;
            $result['cached'] = false;
            
            // Cache successful results
            if ($this->redis) {
                $this->cacheResult($imagePath, $result);
            }
        }
        
        return $result;
    }
    
    /**
     * Process multiple images in batch
     *
     * @param array $imagePaths Array of image file paths
     * @return array Batch results
     */
    public function describeBatch(array $imagePaths): array {
        if (empty($imagePaths)) {
            return [
                'success' => false,
                'error' => 'No image paths provided',
                'results' => []
            ];
        }
        
        // Filter existing files
        $validPaths = array_filter($imagePaths, 'file_exists');
        $invalidPaths = array_diff($imagePaths, $validPaths);
        
        if (empty($validPaths)) {
            return [
                'success' => false,
                'error' => 'No valid image files found',
                'results' => []
            ];
        }
        
        // Check cache for each image
        $uncachedPaths = [];
        $cachedResults = [];
        
        if ($this->redis) {
            foreach ($validPaths as $path) {
                $cached = $this->getCachedResult($path);
                if ($cached !== null) {
                    $cachedResults[$path] = $cached;
                } else {
                    $uncachedPaths[] = $path;
                }
            }
        } else {
            $uncachedPaths = $validPaths;
        }
        
        // Process uncached images
        $batchResults = [];
        if (!empty($uncachedPaths)) {
            $batchResults = $this->processBatch($uncachedPaths);
        }
        
        // Combine cached and batch results
        $allResults = [];
        foreach ($validPaths as $path) {
            if (isset($cachedResults[$path])) {
                $allResults[$path] = $cachedResults[$path];
            } else {
                // Find result in batch results
                foreach ($batchResults as $result) {
                    if (isset($result['metadata']['image_path']) && 
                        $result['metadata']['image_path'] === $path) {
                        $allResults[$path] = $result;
                        
                        // Cache the result
                        if ($this->redis && $result['success']) {
                            $this->cacheResult($path, $result);
                        }
                        break;
                    }
                }
            }
        }
        
        // Add results for invalid paths
        foreach ($invalidPaths as $path) {
            $allResults[$path] = [
                'success' => false,
                'error' => 'Image file not found',
                'results' => []
            ];
        }
        
        return [
            'success' => true,
            'batch_results' => $allResults,
            'total_processed' => count($validPaths),
            'cached_count' => count($cachedResults),
            'processed_count' => count($uncachedPaths),
            'invalid_count' => count($invalidPaths)
        ];
    }
    
    /**
     * Get available NSFW categories
     *
     * @return array Categories and description counts
     */
    public function getCategories(): array {
        $command = sprintf(
            '%s %s --categories 2>&1',
            escapeshellarg($this->pythonEnv),
            escapeshellarg($this->pythonScript)
        );
        
        $output = $this->executeCommand($command);
        return $this->parseOutput($output);
    }
    
    private function buildCommand(string $imagePath, int $topK): string {
        $args = [
            $this->pythonEnv,
            $this->pythonScript,
            $imagePath,
            '--top-k', (string)$topK
        ];
        
        if ($this->debugMode) {
            $args[] = '--debug';
        }
        
        // Add stderr redirect
        $command = implode(' ', array_map('escapeshellarg', $args)) . ' 2>&1';
        
        return $command;
    }
    
    private function executeCommand(string $command): string {
        // Set timeout
        $descriptorSpec = [
            0 => ["pipe", "r"],  // stdin
            1 => ["pipe", "w"],  // stdout
            2 => ["pipe", "w"]   // stderr
        ];
        
        $process = proc_open($command, $descriptorSpec, $pipes);
        
        if (!is_resource($process)) {
            throw new RuntimeException("Failed to start CLIP processor");
        }
        
        // Close stdin
        fclose($pipes[0]);
        
        // Set timeout for output streams
        $startTime = time();
        $output = '';
        $error = '';
        
        while (true) {
            // Check timeout
            if (time() - $startTime > $this->timeout) {
                proc_terminate($process);
                proc_close($process);
                throw new RuntimeException("CLIP processor timed out after {$this->timeout} seconds");
            }
            
            // Read output
            $stdout = fgets($pipes[1]);
            $stderr = fgets($pipes[2]);
            
            if ($stdout === false && $stderr === false) {
                break;
            }
            
            if ($stdout !== false) {
                $output .= $stdout;
            }
            
            if ($stderr !== false) {
                $error .= $stderr;
            }
        }
        
        // Close pipes and process
        fclose($pipes[1]);
        fclose($pipes[2]);
        $returnCode = proc_close($process);
        
        // Log errors if debug mode
        if ($this->debugMode && !empty($error)) {
            error_log("CLIP NSFW Debug: " . $error);
        }
        
        // Handle non-zero return codes
        if ($returnCode !== 0) {
            throw new RuntimeException("CLIP processor failed with code $returnCode: $error");
        }
        
        return $output;
    }
    
    private function processBatch(array $imagePaths): array {
        // Create temporary file with image paths
        $tempFile = tempnam(sys_get_temp_dir(), 'clip_batch_');
        file_put_contents($tempFile, implode("\n", $imagePaths));
        
        try {
            $command = sprintf(
                '%s %s --batch < %s 2>&1',
                escapeshellarg($this->pythonEnv),
                escapeshellarg($this->pythonScript),
                escapeshellarg($tempFile)
            );
            
            $output = $this->executeCommand($command);
            $result = $this->parseOutput($output);
            
            return $result['batch_results'] ?? [];
            
        } finally {
            // Clean up temp file
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }
    
    private function parseOutput(string $output): array {
        $output = trim($output);
        
        if (empty($output)) {
            return [
                'success' => false,
                'error' => 'Empty output from CLIP processor',
                'results' => []
            ];
        }
        
        // Try to decode JSON
        $decoded = json_decode($output, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            return [
                'success' => false,
                'error' => 'Invalid JSON output: ' . json_last_error_msg(),
                'raw_output' => $this->debugMode ? $output : null,
                'results' => []
            ];
        }
        
        return $decoded;
    }
    
    private function getCachedResult(string $imagePath): ?array {
        if (!$this->redis) {
            return null;
        }
        
        try {
            $cacheKey = $this->getCacheKey($imagePath);
            $cached = $this->redis->get($cacheKey);
            
            if ($cached !== false) {
                $result = json_decode($cached, true);
                if ($result !== null) {
                    $result['cached'] = true;
                    return $result;
                }
            }
        } catch (Exception $e) {
            error_log("CLIP NSFW: Cache read error: " . $e->getMessage());
        }
        
        return null;
    }
    
    private function cacheResult(string $imagePath, array $result): void {
        if (!$this->redis) {
            return;
        }
        
        try {
            $cacheKey = $this->getCacheKey($imagePath);
            $cacheData = json_encode($result);
            $this->redis->setex($cacheKey, $this->config['cache_ttl'], $cacheData);
        } catch (Exception $e) {
            error_log("CLIP NSFW: Cache write error: " . $e->getMessage());
        }
    }
    
    private function getCacheKey(string $imagePath): string {
        // Use file hash and modification time for cache key
        $fileHash = md5_file($imagePath);
        $modTime = filemtime($imagePath);
        return "clip_nsfw:{$fileHash}:{$modTime}";
    }
    
    /**
     * Test if CLIP processor is available and working
     *
     * @return array Test result
     */
    public function testAvailability(): array {
        try {
            $command = sprintf(
                '%s %s --categories 2>&1',
                escapeshellarg($this->pythonEnv),
                escapeshellarg($this->pythonScript)
            );
            
            $startTime = microtime(true);
            $output = $this->executeCommand($command);
            $executionTime = microtime(true) - $startTime;
            
            $result = $this->parseOutput($output);
            
            if ($result['success']) {
                return [
                    'available' => true,
                    'categories_count' => $result['total_descriptions'] ?? 0,
                    'response_time' => $executionTime,
                    'python_env' => $this->pythonEnv,
                    'cache_enabled' => $this->redis !== null
                ];
            } else {
                return [
                    'available' => false,
                    'error' => $result['error'] ?? 'Unknown error',
                    'python_env' => $this->pythonEnv
                ];
            }
            
        } catch (Exception $e) {
            return [
                'available' => false,
                'error' => $e->getMessage(),
                'python_env' => $this->pythonEnv
            ];
        }
    }
    
    /**
     * Clear cache for specific image or all cached results
     *
     * @param string|null $imagePath Specific image path or null for all
     * @return bool Success status
     */
    public function clearCache(string $imagePath = null): bool {
        if (!$this->redis) {
            return false;
        }
        
        try {
            if ($imagePath !== null) {
                $cacheKey = $this->getCacheKey($imagePath);
                return $this->redis->del($cacheKey) > 0;
            } else {
                // Clear all CLIP NSFW cache
                $keys = $this->redis->keys('clip_nsfw:*');
                if (!empty($keys)) {
                    return $this->redis->del($keys) > 0;
                }
                return true;
            }
        } catch (Exception $e) {
            error_log("CLIP NSFW: Cache clear error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get cache statistics
     *
     * @return array Cache stats
     */
    public function getCacheStats(): array {
        if (!$this->redis) {
            return ['cache_enabled' => false];
        }
        
        try {
            $keys = $this->redis->keys('clip_nsfw:*');
            return [
                'cache_enabled' => true,
                'cached_images' => count($keys),
                'cache_ttl' => $this->config['cache_ttl'],
                'redis_info' => $this->redis->info('memory')
            ];
        } catch (Exception $e) {
            return [
                'cache_enabled' => true,
                'error' => $e->getMessage()
            ];
        }
    }
}