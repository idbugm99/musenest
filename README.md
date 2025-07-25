# MuseNest

Professional model portfolio management system built with Node.js and MySQL. A modern, normalized rewrite of the RoseMastos Flask application.

## ✨ Features

- **Multi-Theme Support**: 5 beautiful themes (basic, luxury, glamour, modern, dark)
- **Normalized Database**: No JSON fields, proper relational structure
- **Dynamic Routing**: Database-driven page routing and content management
- **Gallery Management**: Professional image galleries with tags and filtering
- **FAQ System**: Categorized frequently asked questions
- **Booking System**: Availability calendar and appointment management
- **Service Management**: Rates, categories, and service descriptions
- **User Management**: Multi-user access with role-based permissions
- **Security First**: Built-in rate limiting, helmet security, and CORS protection

## 🏗️ Architecture

### Database Schema
- **Fully Normalized**: No JSON dependencies, proper foreign keys
- **Theme System**: Separate tables for themes and colors
- **Content Management**: Flexible page sections and metadata
- **Gallery System**: Images with tags and section organization
- **FAQ System**: Categorized questions and answers
- **Service Management**: Categories and pricing structures

### Template Organization
```
templates/
├── basic/          # Clean, minimal design
├── luxury/         # Elegant and sophisticated
├── glamour/        # Dark theme with golden accents
├── modern/         # Contemporary and sleek
└── dark/           # Dark mode variant
```

### Project Structure
```
MuseNest/
├── config/         # Database and app configuration
├── src/            # Application source code
├── templates/      # Theme-based HTML templates
├── public/         # Static assets (CSS, JS, images)
├── database/       # Migration files and schemas
├── scripts/        # Utility and migration scripts
└── docs/           # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MySQL 8.0+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd musenest
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Set up database**
   ```bash
   # Create database
   mysql -u root -p -e "CREATE DATABASE musenest;"
   
   # Run migrations
   npm run migrate
   ```

5. **Add sample data** (optional)
   ```bash
   npm run seed
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Visit your application**
   - API: http://localhost:3000
   - Health check: http://localhost:3000/health

## 📋 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run migrate` - Run database migrations  
- `npm run seed` - Add sample data
- `npm test` - Run tests

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=musenest

# Server
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your_secret_key
BCRYPT_ROUNDS=12
```

### Database Setup

The application uses MySQL with a fully normalized schema. Migration files are located in `database/migrations/` and should be run in order:

1. `001_initial_schema.sql` - Core tables (users, models, themes)
2. `002_gallery_system.sql` - Gallery and image management
3. `003_faq_services_booking.sql` - FAQ, services, and booking
4. `004_testimonials_menu.sql` - Testimonials and menu system
5. `005_seed_data.sql` - Default themes and page types

## 🎨 Themes

### Available Themes

1. **Basic** - Clean, minimal design with blue accents
2. **Luxury** - Elegant brown and gold sophisticated design
3. **Glamour** - Dark theme with golden accents and shimmer effects
4. **Modern** - Contemporary green and purple design
5. **Dark** - Dark mode with indigo and amber accents

### Theme Structure

Each theme has its own folder in `templates/` with template files:
- `index.html` - Homepage template
- `about.html` - About page template  
- `gallery.html` - Gallery page template
- `faq.html` - FAQ page template
- `contact.html` - Contact page template
- `rates.html` - Rates page template

## 📊 Database Schema

### Core Tables
- `users` - User authentication and profiles
- `models` - Model entities with billing info
- `model_users` - Multi-user access relationships
- `themes` & `theme_colors` - Normalized theme system
- `site_settings` - Per-model configuration

### Content Management
- `page_types` & `pages` - Dynamic page system
- `page_sections` - Flexible content sections
- `section_metadata` - Extensible section attributes

### Gallery System
- `gallery_sections` - Gallery organization
- `gallery_images` - Image management
- `image_tags` - Normalized tagging system

### Business Logic
- `faq_categories` & `faq_items` - FAQ management
- `service_categories` & `services` - Service offerings
- `availability` & `bookings` - Scheduling system
- `testimonials` - Client feedback

## 🔐 Security Features

- **Helmet.js** - Security headers
- **Rate Limiting** - Prevent abuse
- **CORS Protection** - Cross-origin request security
- **Input Validation** - SQL injection prevention
- **JWT Authentication** - Secure user sessions
- **Password Hashing** - bcrypt encryption

## 🌟 Migration from RoseMastos

This is a complete rewrite of the RoseMastos Flask application with these improvements:

### Database Normalization
- ❌ JSON fields eliminated
- ✅ Proper foreign key relationships
- ✅ Normalized theme and color storage
- ✅ Structured content management

### Architecture Improvements
- ❌ Monolithic Flask structure
- ✅ Modular Node.js architecture
- ✅ Theme-based template organization
- ✅ API-first design

### Performance Enhancements
- ✅ Connection pooling
- ✅ Query optimization
- ✅ Static file serving
- ✅ Caching strategies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please open an issue on GitHub or contact the development team.

---

**MuseNest** - Professional model portfolio management, reimagined. 🌟