# Universal Gallery System - Comprehensive Test Suite

This comprehensive test suite ensures the reliability, performance, and accessibility of the Universal Gallery System across all supported browsers, devices, and use cases.

## Test Coverage

### 🧪 Unit Tests (`unit/`)
- **UniversalGalleryService.test.js**: Core service functionality, configuration management, state handling
- **GalleryModules.test.js**: Individual module testing (lightbox, masonry, prefetch)
- **PerformanceService.test.js**: Performance monitoring and metrics collection
- **AnalyticsService.test.js**: User behavior tracking and event collection

### 🔗 Integration Tests (`integration/`)
- **gallery-api.test.js**: API endpoint testing with mock data
- **theme-integration.test.js**: Theme system integration testing
- **database-integration.test.js**: Database operations and migrations
- **performance-integration.test.js**: End-to-end performance monitoring

### 🎭 End-to-End Tests (`e2e/`)
- **gallery-functionality.test.js**: Complete user workflows across multiple browsers
- **accessibility.test.js**: WCAG compliance and screen reader compatibility
- **performance.test.js**: Real-world performance benchmarking
- **visual-regression.test.js**: Screenshot comparison testing

### 📊 Performance Tests (`performance/`)
- **performance-benchmarks.test.js**: Core Web Vitals, image loading, memory usage, JS execution, network performance
- **load-testing.test.js**: Concurrent user simulation, high-volume scenarios, memory/network stress testing
- **accessibility-performance.test.js**: Screen reader performance, keyboard navigation, focus management, reduced motion
- **visual-regression-performance.test.js**: Screenshot capture performance, image comparison benchmarking
- **run-performance-tests.js**: Comprehensive test runner with consolidated reporting

## Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Install browser engines for E2E tests
npm run install-browsers

# Set up test environment
npm run setup
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
npm run test:performance  # Performance tests only
npm run test:accessibility # Accessibility tests only

# Run comprehensive performance testing
npm run test:performance:full        # Complete performance test suite with reports
npm run test:performance:benchmarks  # Core Web Vitals & benchmarks only
npm run test:performance:load        # Load testing & stress testing only
npm run test:performance:a11y        # Accessibility performance only
npm run test:performance:visual      # Visual regression performance only

# Watch mode for development
npm run test:watch

# Debug mode
npm run test:debug

# CI/CD mode
npm run test:ci
```

### Coverage Reports

```bash
# Generate coverage report
npm run coverage

# Open coverage report in browser
npm run coverage:open

# Open performance reports
npm run report                    # Consolidated performance report
npm run report:performance        # Core performance benchmarks
npm run report:load               # Load testing results
npm run report:a11y               # Accessibility performance
npm run report:visual             # Visual regression performance
```

## Test Configuration

### Environment Variables

```bash
# Test database configuration
TEST_DB_HOST=localhost
TEST_DB_USER=root
TEST_DB_PASSWORD=
TEST_DB_NAME=musenest_test
TEST_DB_PORT=3306

# Test server configuration
TEST_PORT=3001

# Browser configuration
E2E_BROWSERS=chromium,firefox,webkit
HEADLESS=true

# Performance test configuration
PERFORMANCE_THRESHOLD_LCP=2500
PERFORMANCE_THRESHOLD_FID=100
PERFORMANCE_THRESHOLD_CLS=0.1

# Debug options
TEST_VERBOSE=true
NODE_ENV=test
```

### Test Data Configuration

Test data is automatically generated and managed:

- **Mock Images**: Dynamic image generation using Picsum for consistent testing
- **Mock APIs**: Comprehensive API mocking with error simulation
- **Test Database**: Isolated test database with automatic setup/teardown
- **Sample Configurations**: Pre-configured gallery layouts and themes

## Browser Support

E2E tests run across multiple browser engines:

- **Chromium** (Chrome, Edge)
- **Firefox** 
- **WebKit** (Safari)

### Mobile Testing

Tests include mobile and tablet viewport testing:

- **Mobile**: 375x812 (iPhone-like)
- **Tablet**: 768x1024 (iPad-like)  
- **Desktop**: 1920x1080

## Performance Benchmarks

### Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| FID (First Input Delay) | ≤ 100ms | ≤ 300ms | > 300ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |

### Image Performance Targets

- **Max Load Time**: 3 seconds per image
- **Max Transfer Size**: 500KB per image  
- **Cache Hit Rate**: 80% minimum
- **Lazy Loading**: 100% implementation

## Accessibility Standards

Tests ensure compliance with:

- **WCAG 2.1 Level AA** standards
- **Section 508** compliance
- **Keyboard Navigation** support
- **Screen Reader** compatibility
- **Focus Management** in modal interactions

### Accessibility Test Categories

- **Keyboard Navigation**: Tab order, arrow key navigation, escape handling
- **ARIA Labels**: Proper labeling and descriptions
- **Color Contrast**: Minimum 4.5:1 ratio for normal text
- **Focus Management**: Visible focus indicators and logical tab flow

## Visual Regression Testing

Automated screenshot comparison across:

- **Multiple Themes**: Modern, Luxury, Minimal
- **Multiple Viewports**: Desktop, Tablet, Mobile
- **Multiple States**: Default, Loading, Error, Lightbox Open
- **Multiple Browsers**: Chromium, Firefox, WebKit

### Updating Baselines

```bash
# Update all visual baselines
npm run screenshots:update

# Update specific test baselines
npm run test:visual -- --updateSnapshot
```

## Error Simulation

Tests include comprehensive error simulation:

### Network Errors
- **API Failures**: Random API response failures
- **Network Delays**: Simulated slow connections
- **Offline Mode**: Testing offline functionality

### Image Loading Errors
- **Broken Images**: 404 image responses
- **Slow Loading**: Delayed image responses
- **Mixed Success/Failure**: Partial loading scenarios

### JavaScript Errors
- **Service Failures**: Analytics/performance service errors
- **Module Load Failures**: Dynamic import failures
- **Runtime Exceptions**: Error boundary testing

## Continuous Integration

### GitHub Actions Integration

The test suite integrates with CI/CD pipelines:

```yaml
# Example CI configuration
- name: Run Universal Gallery Tests
  run: |
    npm ci
    npm run install-browsers
    npm run test:ci
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./tests/universal-gallery/reports/coverage/lcov.info
```

### Test Reports

Generated reports include:

- **Coverage Reports**: HTML and LCOV formats
- **Performance Reports**: Core Web Vitals and custom metrics
- **Accessibility Reports**: WCAG compliance details
- **Visual Regression**: Screenshot diff reports
- **JUnit XML**: For CI/CD integration

## Performance Optimization

### Test Performance Tips

- **Parallel Execution**: Tests run in parallel where possible
- **Browser Reuse**: Contexts are reused within test files
- **Mock Data**: Efficient mock data generation
- **Selective Screenshots**: Screenshots only on failures or when needed

### Memory Management

- **Automatic Cleanup**: Test setup includes comprehensive cleanup
- **Resource Limits**: Tests have memory and time limits
- **Leak Detection**: Built-in memory leak detection

## Debugging Tests

### Debug Mode

```bash
# Run tests in debug mode with Node.js inspector
npm run test:debug

# Then attach debugger to localhost:9229
```

### Browser DevTools

```bash
# Run E2E tests with browser DevTools open
HEADLESS=false npm run test:e2e
```

### Verbose Output

```bash
# Enable verbose test output
TEST_VERBOSE=true npm test
```

### Screenshots on Failure

Failed E2E tests automatically capture screenshots:

```bash
# Screenshots saved to: ./reports/screenshots/
# Filename format: failed-{timestamp}.png
```

## Contributing to Tests

### Writing New Tests

1. **Unit Tests**: Add to appropriate module test files
2. **Integration Tests**: Create in `integration/` directory
3. **E2E Tests**: Add to `e2e/gallery-functionality.test.js` or create new files
4. **Performance Tests**: Add to `performance/` directory

### Test Conventions

- **Descriptive Names**: Clear test descriptions
- **Arrange-Act-Assert**: Clear test structure
- **Independent Tests**: No test dependencies
- **Cleanup**: Proper teardown in afterEach/afterAll

### Mock Data Guidelines

- **Realistic Data**: Use realistic image URLs and data
- **Deterministic**: Consistent mock data for reproducible tests
- **Edge Cases**: Include edge cases and error scenarios

## Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check MySQL is running
brew services start mysql
# Or adjust TEST_DB_* environment variables
```

**Browser Installation Issues**
```bash
# Reinstall browser engines
npx playwright install --force
```

**Port Conflicts**
```bash
# Change test port
TEST_PORT=3002 npm test
```

**Memory Issues**
```bash
# Reduce parallel workers
npm test -- --maxWorkers=2
```

### Getting Help

- Check test logs in `./reports/`
- Review failed screenshots in `./reports/screenshots/`
- Check coverage reports for uncovered code paths
- Use debug mode for step-by-step execution

---

## Test Architecture

### Test Flow

```
Setup → Unit Tests → Integration Tests → E2E Tests → Performance Tests → Teardown
  ↓         ↓              ↓               ↓              ↓            ↓
Database   Mock          API            Browser        Metrics     Cleanup
 Setup    Services      Testing        Testing        Analysis
```

### Dependencies

```
Universal Gallery System
├── Core Services (UniversalGalleryService)
├── Modules (Lightbox, Masonry, Prefetch)  
├── Performance Monitoring
├── Analytics Tracking
├── Theme Integration
└── Database Layer
```

This comprehensive test suite ensures the Universal Gallery System maintains high quality, performance, and accessibility standards across all supported environments and use cases.