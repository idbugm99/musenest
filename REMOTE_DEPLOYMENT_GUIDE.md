# Remote Server Deployment Guide

## 🎯 **Deploy to 18.221.22.72:5000**

### **Files to Deploy:**
1. **enhanced_minimal_v3_with_blip.py** (updated with configuration system)

### **Dependencies to Install on Remote Server:**
```bash
pip3 install opencv-python nudenet flask pillow --break-system-packages
# OR using pip without system packages:
pip3 install opencv-python nudenet flask pillow
```

### **Start Command:**
```bash
# Background with log export:
python3 enhanced_minimal_v3_with_blip.py > server.log 2>&1 &

# Or foreground:
python3 enhanced_minimal_v3_with_blip.py
```

### **Verify Deployment:**
```bash
# Check health:
curl http://18.221.22.72:5000/health

# Check configuration endpoints:
curl http://18.221.22.72:5000/config/public_site
curl http://18.221.22.72:5000/api-keys
curl http://18.221.22.72:5000/configuration

# Test analysis with configuration:
curl -X POST http://18.221.22.72:5000/analyze \
  -F "image=@test.jpg" \
  -F "enable_breast_detection=false" \
  -F "enable_genitalia_detection=false" \
  -F "context_type=paysite"
```

### **Expected Server Output:**
```
🚀 Initializing Enhanced Minimal v3.0 with BLIP...
🖼️ Attempting to load BLIP model...
⚠️ BLIP model failed to load: No module named 'transformers'
📝 Will use fallback image description method
✅ Enhanced Minimal v3.0 with BLIP initialized successfully!
🚀 Starting Enhanced Minimal v3.0 with BLIP + Configuration
* Running on all addresses (0.0.0.0)
* Running on http://127.0.0.1:5000
* Running on http://18.221.22.72:5000
```

### **Key Features Enabled:**
- ✅ Single unified server (no separate config API)
- ✅ Request-based configuration parsing
- ✅ Component filtering (breast, genitalia, face detection)
- ✅ MuseNest compatibility endpoints
- ✅ Child protection always active
- ✅ All 404 errors fixed

### **What Changed:**
- Integrated ConfigurableAnalysisComponents into main server
- Added configuration endpoints to main server
- Updated analyze_image method to use config filtering
- Fixed architectural issue (single server, single port)