

## 🗄️ Database (Phase 1 only)
**Table: `users`**  
- `id` — INTEGER PK (autoincrement)  
- `username` — TEXT UNIQUE (case-insensitive match in app logic)  
- `password_hash` — TEXT (bcrypt/argon2 PHC string)  
- `display_name` — TEXT  
- `email` — TEXT UNIQUE (optional in Phase 1)  
- `created_at` — TEXT (ISO datetime)  
- `updated_at` — TEXT (ISO datetime)

