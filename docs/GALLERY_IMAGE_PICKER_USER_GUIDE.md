# Gallery Image Picker - User Guide

## Overview

The Gallery Image Picker is a professional, multi-select image management tool designed for adding images to gallery sections with robust safety controls and batch operations.

## Features

### 🖼️ **Multi-Select Image Management**
- **Batch Operations**: Select multiple images and add them all at once
- **Smart Selection**: Persistent selection across pages and filters
- **Visual Feedback**: Clear selection indicators and counters
- **Keyboard Support**: Arrow keys, Space to select, Enter to add

### 🛡️ **Public Safety Controls**
- **Automatic Filtering**: Public sections show only approved, public-safe content
- **Context Awareness**: Different defaults for public vs private sections
- **Visual Indicators**: Color-coded badges show content status and context
- **Safety Enforcement**: Server blocks inappropriate content from public sections

### 🔍 **Advanced Filtering & Search**
- **Status Filters**: Approved Only, Approved + Blurred, All Statuses
- **Context Filters**: Public Site, Paysite, Private, All Contexts  
- **Search**: Real-time filename search with 300ms debouncing
- **Sorting**: Newest first, Oldest first, Name A-Z
- **Pagination**: 24 images per page for optimal performance

### 📊 **Progress Tracking & Results**
- **Batch Progress**: Real-time progress bar during operations
- **Detailed Results**: Shows added/skipped/failed counts with reasons
- **Error Handling**: Graceful failure handling with clear explanations
- **Operation Logging**: Comprehensive logging for monitoring and debugging

## How to Use

### Opening the Picker

1. **Navigate** to your model's Gallery Manager page
2. **Click** "Add Images to Gallery" button for any section
3. The picker opens with **context-aware defaults** based on section type

### Selecting Images

#### Multi-Select Mode (Default)
- **Click any image** to toggle selection
- **Use checkboxes** for precise selection control
- **Select All (Page)** button selects all visible images
- **Clear Selection** button deselects all images

#### Single-Select Mode
- **Toggle off** Multi-Select Mode for traditional single image selection
- **Click image** to select only that one
- **Useful** for quick single additions

### Filtering Content

#### For Public Sections
- **Status Filter**: Defaults to "Approved Only (Public Safe)"
- **Context Filter**: Defaults to "Public Site (Free)"
- **Locked Options**: Dangerous filters disabled for safety
- **Help Messages**: Explains why certain content can't be added

#### For Private Sections
- **Status Filter**: Defaults to "Approved + Blurred" 
- **Context Filter**: Defaults to "All Contexts"
- **All Options Available**: No restrictions on content type
- **Confirmation Dialogs**: Warns about flagged/private content

### Adding Images

1. **Select desired images** using multi-select
2. **Review selection** in the preview chips area
3. **Click** "Add X to Gallery" button
4. **Monitor progress** in the progress modal
5. **Review results** showing success/skip/failure details

### Understanding Results

#### Success Messages
- **Added**: Images successfully added to gallery section
- **Skipped**: Images already in section (automatic deduplication)
- **Failed**: Images blocked for safety or other reasons

#### Common Failure Reasons
- **"Already in section"**: Image was previously added
- **"Not safe for public section"**: Flagged content blocked from public section  
- **"Not intended for public section"**: Private/paysite content blocked from public section
- **"Image not found in library"**: File doesn't exist or was deleted

## Safety Features

### Public Section Protection
**Public sections** (visible to website visitors) have strict safety controls:

- ✅ **Allowed**: Approved content intended for public viewing
- ✅ **Allowed**: Approved + blurred content with proper blurred display
- ❌ **Blocked**: Pending, flagged, or rejected content
- ❌ **Blocked**: Content marked for paysite or private use only
- 🚨 **Server Enforcement**: Multiple validation layers prevent bypassing

### Private Section Flexibility  
**Private sections** (admin-only or member-only) allow broader content:

- ✅ **Allowed**: All approved and blurred content
- ⚠️ **Warned**: Flagged or private content shows confirmation dialog
- ✅ **Allowed**: Content for paysite or private use
- 📋 **User Choice**: Admin decides what's appropriate

### Security Measures
- **Input Validation**: Filename format and security checks
- **Rate Limiting**: Maximum 100 images per batch operation
- **Audit Logging**: All operations logged with IP and user details
- **Model Ownership**: Users can only access their own model's content

## Advanced Features

### Legacy Mode
For compatibility with existing workflows:

- **Click** "Legacy Mode" button to reveal single-file input
- **Use traditional** filename input and browse method
- **Fallback option** when batch operations aren't needed
- **Hide/show** toggle to reduce interface complexity

### Keyboard Navigation
- **Arrow Keys**: Navigate between image tiles
- **Space Bar**: Toggle selection of focused image
- **Enter Key**: Add selected images to gallery
- **Escape Key**: Close picker modal

### Performance Optimizations
- **Database Indexes**: Optimized queries return results in ~3ms
- **Image Lazy Loading**: Faster initial load times
- **Debounced Search**: Reduces server requests during typing
- **Pagination**: Handles large image libraries efficiently

## Troubleshooting

### Picker Won't Open
- **Check browser console** for JavaScript errors
- **Ensure** Gallery Image Picker component is properly loaded
- **Verify** section information is available

### Images Not Loading
- **Check file permissions** on uploads directory
- **Verify** image files exist at expected paths
- **Check database** filename entries match actual files

### Batch Operations Failing
- **Review results modal** for specific error messages
- **Check server logs** for detailed failure information
- **Verify** model ownership and section permissions

### Performance Issues
- **Use filters** to reduce image counts per page
- **Clear browser cache** if interface seems slow
- **Check database indexes** are properly created

## Best Practices

### Content Organization
- **Use descriptive filenames** for easier searching
- **Apply appropriate context tags** (public/paysite/private)
- **Keep public sections** limited to approved content
- **Regular review** of flagged content in private sections

### Batch Operations
- **Review selections** before adding to avoid mistakes
- **Use filters** to find specific content types quickly
- **Monitor results** to understand what worked and what didn't
- **Start small** with new sections before bulk operations

### Safety & Compliance
- **Follow platform guidelines** for public content
- **Review flagged content** carefully before publishing
- **Use private sections** for questionable content during review
- **Regular audits** of public section content

## Support

### Getting Help
- **Check this documentation** for common solutions
- **Review server logs** for detailed error information
- **Contact system administrator** for technical issues
- **Report bugs** through appropriate channels

### Feature Requests
- **Document specific use cases** when requesting features
- **Consider security implications** of proposed changes
- **Test thoroughly** in development before production use

---

*This guide covers the Gallery Image Picker system as of August 2025. Features and interface may change in future updates.*