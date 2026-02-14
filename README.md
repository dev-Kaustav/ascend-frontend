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

- `/app/dashboard`
- `/app/orders`
- `/app/orders/new`
- `/app/orders/{id}`
- `/app/inventory`
- `/app/inventory/add`
- `/app/accounting`
- `/app/users`
- `/app/profile`
- `/app/catalog`
- `/app/create`
- `/app/retail-coverage`
- `/app/cash-collection`
- `/app/salesmen`
- `/app/drivers`
- `/app/invoices`
- `/app/credit-notes`

## API Expectations

The UI expects these endpoints to exist:

- `POST /auth/login`
- `GET /auth/access-rules`
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
