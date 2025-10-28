# phoenix4ge Template Addition Workflow

## Overview
This document outlines the complete workflow for adding new themes to the phoenix4ge system.

## Prerequisites
- phoenix4ge server running with Handlebars configuration
- Database access to add theme sets
- Understanding of Handlebars templating

## Step 1: Create Theme Directory Structure

```bash
mkdir -p themes/[theme-name]/layouts
mkdir -p themes/[theme-name]/partials
mkdir -p themes/[theme-name]/pages
```

**Example:**
```bash
mkdir -p themes/elegant/layouts
mkdir -p themes/elegant/partials  
mkdir -p themes/elegant/pages
```

## Step 2: Create Main Layout

Create `themes/[theme-name]/layouts/main.handlebars`:

```handlebars
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{#if content.pageTitle}}{{content.pageTitle}} - {{/if}}{{siteName}}</title>
    
    <!-- Theme-specific CSS -->
    <style>
        /* Theme variables */
        :root {
            --primary-color: #your-color;
            --secondary-color: #your-color;
            --text-color: #your-color;
            --background-color: #your-color;
        }
        
        /* Theme-specific styles */
        .theme-heading { /* Your styles */ }
        .theme-btn { /* Your styles */ }
        
        /* Responsive design */
        @media (max-width: 768px) {
            /* Mobile styles */
        }
    </style>
    
    <!-- External dependencies -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body>
    {{> header}}
    
    <main>
        {{{body}}}
    </main>
    
    {{> footer}}
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
```

## Step 3: Create Partials

### Header Partial (`themes/[theme-name]/partials/header.handlebars`)

```handlebars
<header class="theme-header">
    <nav class="navbar navbar-expand-lg">
        <div class="container">
            <a class="navbar-brand" href="/{{modelSlug}}">{{siteName}}</a>
            
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    {{#each navigation}}
                    <li class="nav-item">
                        <a class="nav-link {{#if active}}active{{/if}}" href="{{url}}">{{name}}</a>
                    </li>
                    {{/each}}
                </ul>
            </div>
        </div>
    </nav>
</header>
```

### Footer Partial (`themes/[theme-name]/partials/footer.handlebars`)

```handlebars
<footer class="theme-footer">
    <div class="container">
        <div class="row">
            <div class="col-md-6">
                <p>&copy; {{year}} {{siteName}}. All rights reserved.</p>
            </div>
            <div class="col-md-6 text-end">
                <div class="social-links">
                    <!-- Social media links -->
                </div>
            </div>
        </div>
    </div>
</footer>
```

## Step 4: Create Page Templates

Create templates for each page type in `themes/[theme-name]/pages/`:

### Home Page (`home.handlebars`)
```handlebars
<!-- Hero Section -->
<section class="hero-section">
    <div class="container">
        <h1 class="theme-heading">{{content.heroTitle}}</h1>
        <p class="lead">{{content.heroSubtitle}}</p>
        <div class="hero-buttons">
            <a href="/{{modelSlug}}/contact" class="theme-btn">{{content.heroButton1}}</a>
            <a href="/{{modelSlug}}/about" class="theme-btn-outline">{{content.heroButton2}}</a>
        </div>
    </div>
</section>

<!-- Additional sections as needed -->
```

### About Page (`about.handlebars`)
```handlebars
<section class="about-hero">
    <div class="container">
        <h1 class="theme-heading">About {{siteName}}</h1>
        <p class="lead">{{content.aboutSubtitle}}</p>
    </div>
</section>

<section class="about-content">
    <div class="container">
        <div class="row">
            <div class="col-lg-8">
                <h2>{{content.pageTitle}}</h2>
                <p>{{content.mainParagraph1}}</p>
                <p>{{content.mainParagraph2}}</p>
                
                {{#if content.servicesList}}
                <h3>{{content.servicesTitle}}</h3>
                <ul>
                    {{#each (split content.servicesList '\n')}}
                    <li>{{this}}</li>
                    {{/each}}
                </ul>
                {{/if}}
            </div>
        </div>
    </div>
</section>
```

### Contact Page (`contact.handlebars`)
```handlebars
<section class="contact-hero">
    <div class="container">
        <h1 class="theme-heading">Contact {{siteName}}</h1>
    </div>
</section>

<section class="contact-content">
    <div class="container">
        <div class="row">
            <div class="col-md-6">
                <h2>Get in Touch</h2>
                <p>{{content.contactIntro}}</p>
                
                <div class="contact-info">
                    <p><i class="fas fa-envelope"></i> {{model.email}}</p>
                </div>
            </div>
            <div class="col-md-6">
                <form class="contact-form">
                    <div class="mb-3">
                        <input type="text" class="form-control" placeholder="Name" required>
                    </div>
                    <div class="mb-3">
                        <input type="email" class="form-control" placeholder="Email" required>
                    </div>
                    <div class="mb-3">
                        <textarea class="form-control" rows="5" placeholder="Message" required></textarea>
                    </div>
                    <button type="submit" class="theme-btn">Send Message</button>
                </form>
            </div>
        </div>
    </div>
</section>
```

### Gallery Page (`gallery.handlebars`)
```handlebars
<section class="gallery-hero">
    <div class="container">
        <h1 class="theme-heading">Gallery</h1>
        <p class="lead">{{content.galleryIntro}}</p>
    </div>
</section>

<section class="gallery-content">
    <div class="container">
        <div class="row">
            <!-- Gallery grid - integrate with actual gallery data -->
            <div class="col-md-4 mb-4">
                <div class="gallery-item">
                    <img src="/placeholder-image.jpg" alt="Gallery Image" class="img-fluid">
                </div>
            </div>
            <!-- Repeat for more gallery items -->
        </div>
    </div>
</section>
```

### Rates Page (`rates.handlebars`)
```handlebars
<section class="rates-hero">
    <div class="container">
        <h1 class="theme-heading">Rates & Services</h1>
        <p class="lead">{{content.ratesIntro}}</p>
    </div>
</section>

<section class="rates-content">
    <div class="container">
        <div class="row">
            <div class="col-lg-8">
                <h2>{{content.servicesTitle}}</h2>
                
                {{#if content.servicesList}}
                <div class="services-list">
                    {{#each (split content.servicesList '\n')}}
                    <div class="service-item">
                        <h4>{{this}}</h4>
                    </div>
                    {{/each}}
                </div>
                {{/if}}
            </div>
        </div>
    </div>
</section>
```

## Step 5: Add Theme to Database

Add the new theme to the `theme_sets` table:

```sql
INSERT INTO theme_sets (name, display_name, description, category, default_color_scheme, features, is_active) 
VALUES (
    '[theme-name]', 
    '[Theme Display Name]', 
    '[Theme description]', 
    'professional', 
    '{"primary": "#color", "secondary": "#color", "text": "#color"}',
    '["responsive", "modern", "customizable"]',
    1
);
```

**Example:**
```sql
INSERT INTO theme_sets (name, display_name, description, category, default_color_scheme, features, is_active) 
VALUES (
    'elegant', 
    'Elegant Professional', 
    'Sophisticated design with clean typography and subtle animations', 
    'professional', 
    '{"primary": "#2C3E50", "secondary": "#E74C3C", "text": "#34495E"}',
    '["responsive", "modern", "customizable", "animations"]',
    1
);
```

## Step 6: Add Theme Mapping

Update the theme mapping in `src/routes/model_sites.js`:

```javascript
const themeMapping = {
    'basic': 'basic',
    'glamour': 'glamour', 
    'luxury': 'luxury',
    'modern': 'modern',
    'dark': 'dark',
    '[theme-name]': '[theme-name]'  // Add your theme here
};
```

## Step 7: Create Test Route (Optional)

Add a test route in `server.js` for development:

```javascript
app.get('/test-[theme-name]', (req, res) => {
    const sampleData = {
        siteName: 'Sample Model',
        modelSlug: 'sample',
        content: {
            heroTitle: 'Welcome to Elegance',
            heroSubtitle: 'Experience sophistication and style',
            heroButton1: 'Get Started',
            heroButton2: 'Learn More'
        },
        navigation: [
            { name: 'Home', url: '/test-[theme-name]', active: true },
            { name: 'About', url: '/test-[theme-name]/about', active: false },
            { name: 'Gallery', url: '/test-[theme-name]/gallery', active: false },
            { name: 'Contact', url: '/test-[theme-name]/contact', active: false }
        ],
        year: new Date().getFullYear()
    };
    
    res.render('[theme-name]/pages/home', sampleData);
});
```

## Step 8: Test Theme

1. **Access test URL**: `http://localhost:3000/test-[theme-name]`
2. **Assign to model**: Use Theme Management in admin interface
3. **View live site**: `http://localhost:3000/[model-slug]`

## Step 9: Content Field Mapping

Ensure your theme uses the correct content field names. Common content fields available:

- `heroTitle` - Main page title
- `heroSubtitle` - Page subtitle/description
- `pageTitle` - Page-specific title
- `mainParagraph1-4` - Main content paragraphs
- `servicesTitle` - Services section title
- `servicesList` - List of services (newline-separated)
- `interestsTitle` - Interests section title
- `interests` - List of interests
- `ctaSectionTitle` - Call-to-action title
- `ctaSectionSubtitle` - Call-to-action subtitle

## Best Practices

1. **Responsive Design**: Ensure themes work on all device sizes
2. **Accessibility**: Use proper ARIA labels and semantic HTML
3. **Performance**: Optimize CSS and minimize external dependencies
4. **Consistency**: Follow established naming conventions
5. **Testing**: Test with different content lengths and edge cases
6. **Documentation**: Document any special features or requirements

## Troubleshooting

### Theme Not Loading
- Check theme name matches database exactly
- Verify file paths and directory structure
- Check server logs for errors

### Content Not Displaying
- Verify content field names match database
- Check content transformation in routing
- Ensure content exists for the model

### Styling Issues
- Check CSS syntax and conflicts
- Verify Bootstrap classes are correct
- Test responsive breakpoints

## Support

For additional help with theme development, refer to:
- Handlebars documentation: https://handlebarsjs.com/
- Bootstrap documentation: https://getbootstrap.com/
- phoenix4ge admin interface for theme assignment and content management