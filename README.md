# CertiFlow

CertiFlow is a batch-based certificate generation and verification platform with multi-level approval, automated PDF generation, QR-based verification, and WhatsApp delivery.

## 1. Clone the Repository

```bash
git clone <repository-url>
cd certiflow
```

## 2. Project Structure

```
certiflow/
├── apps/
│   ├── api/    # Backend (Express, TypeScript, Prisma)
│   └── web/    # Frontend
└── README.md
```

## 3. Backend Setup (`apps/api`)

```bash
cd apps/api
npm install
```

Create `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/certiflow?schema=public"
JWT_SECRET="<your-jwt-secret>"
```

> If your password contains `@`, URL-encode it as `%40` in the connection string.

Create the database in PostgreSQL:

```sql
CREATE DATABASE certiflow;
```

Generate the Prisma client and apply database migrations using your project's Prisma 8 workflow.

Start the backend:

```bash
npm run dev
```

<sub>Backend: http://localhost:3001</sub>

## 4. Frontend Setup (`apps/web`)

```bash
cd apps/web
npm install
npm run dev
```

<sub>Frontend: http://localhost:5173</sub>

## 5. Database Tables

| Table          | Purpose                                                            |
| -------------- | ------------------------------------------------------------------ |
| User           | Stores staff accounts, roles and authentication details.           |
| TrainingCentre | Stores training centre information.                                |
| Batch          | Represents a candidate batch submitted for certification.          |
| Candidate      | Stores candidate details and batch association.                    |
| Approval       | Tracks multi-level batch approval and approval status.             |
| Certificate    | Stores generated certificate records, IDs and verification tokens. |

## 6. Approval Workflow

```
Training Centre
      ↓
Batch Submission
      ↓
District Officer 1
      ↓
District Officer 2
      ↓
State Admin Approval
      ↓
Certificate Generation
      ↓
Public Verification
```

## 7. Key Features

- JWT-based staff authentication and role-based access.
- Batch upload through CSV.
- Multi-level batch approval.
- Automated certificate PDF generation.
- QR code-based public verification.
- WhatsApp certificate delivery.
- Public certificate verification without candidate login.

## 8. API

```
Backend:      http://localhost:3001
API:          http://localhost:3001/api
Verification: /api/certificates/verify/:token
```

## 9. Development

Run the frontend and backend in two separate terminals.

```bash
# Terminal 1
cd apps/api
npm run dev

# Terminal 2
cd apps/web
npm run dev
```
