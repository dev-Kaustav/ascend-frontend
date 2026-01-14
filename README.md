# Ascend Foods Frontend

Role-based dashboards for the Ascend Foods GTM Distribution Platform.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure the API base URL:
   ```bash
   export NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

## Auth Flow

- Login at `/login`
- JWT is stored in session storage
- Requests attach `Authorization: Bearer <token>` and include cookies
- Auto-logout on `401` responses

## Routes

- `/app/admin/dashboard`
- `/app/admin/orders`
- `/app/admin/inventory`
- `/app/admin/accounting`
- `/app/admin/retail-coverage`
- `/app/admin/cash-collection`
- `/app/admin/salesmen`
- `/app/admin/invoices`
- `/app/admin/credit-notes`
- `/app/brand/dashboard`
- `/app/retailer/dashboard`

## API Expectations

The UI expects these endpoints to exist:

- `POST /auth/login`
- `GET /admin/orders`
- `GET /admin/inventory`
- `GET /admin/retailers`
- `GET /admin/salesmen`
- `GET /admin/skus`
- `GET /admin/warehouses`
- `GET /accounting/payments`
- `GET /accounting/credit-notes`
- `GET /orders/{id}`
- `GET /orders/{id}/invoice-view`
- `GET /brand/dashboard`
- `GET /retailer/orders`

If your backend uses different paths, update `ascend-frontend/lib/api.js`.
