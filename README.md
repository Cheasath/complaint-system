# Smart Campus Complaint Management System

A full-stack campus complaint platform built with React, TypeScript, Express, Prisma, and MongoDB.

## Features

- Student registration and login
- Administrator and student role-based access
- Complaint submission, filtering, and status lifecycle
- Department assignment and resolution workflow
- Complaint comments and internal administrator notes
- Attachment upload support
- Student feedback and ratings
- Database-backed student/admin dashboards
- Category and department analytics
- Dark and light interface themes
- Responsive desktop and mobile layouts

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Administrator | admin@campus.edu | Password123! |
| Student | student@campus.edu | Password123! |

## MongoDB setup

If `server/.env` does not exist, create it from the example:

```powershell
Copy-Item server\.env.example server\.env
```

Set `DATABASE_URL` in `server/.env` to your MongoDB connection string before starting. Prisma's MongoDB connector requires a replica set for its relation writes. For the local Docker replica set below, use `mongodb://localhost:27017/smart_campus?replicaSet=rs0`; for Atlas, use the URI from Atlas and include the database name. MongoDB Compass is a database client, so the MongoDB server must also be running locally or available through Atlas. For Atlas, create a database user and allow your machine's IP in Network Access.

For a local development database with Docker, start MongoDB and initialize its replica set once:

```powershell
docker compose up -d
docker exec smart-campus-mongodb mongosh --quiet --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'localhost:27017' }] })"
```

Then connect Compass to `mongodb://127.0.0.1:27017`.

```powershell
npm install
npm run setup
cd server
npx prisma generate
npm run prisma:push
npm run seed
cd ..
npm run dev
```

`prisma db push` applies the Prisma schema to MongoDB; Prisma Migrate is not supported for MongoDB. Existing SQLite data is not copied automatically.
`npm run seed` clears the demo collections before inserting sample accounts and complaints, so only run it against an empty development database.

Open `http://localhost:5173`. The API runs at `http://localhost:4000/api`.

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/complaints`
- `POST /api/complaints`
- `GET /api/complaints/:id`
- `PATCH /api/complaints/:id/status`
- `POST /api/complaints/:id/comments`
- `POST /api/complaints/:id/feedback`
- `GET /api/dashboard/student`
- `GET /api/analytics`
- `GET /api/users`
- `PATCH /api/users/:id`

Authentication uses secure HTTP-only cookies. API responses do not expose password hashes.

## Production notes

Set strong values for `JWT_SECRET`, `DATABASE_URL`, and `CLIENT_URL`. Replace local disk attachment storage with Cloudinary or object storage for horizontally scaled deployments. Configure HTTPS and secure cookie settings behind a reverse proxy.
