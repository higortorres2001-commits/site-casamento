# Core Functions Documentation - AI Optimized

## Payment Flow Core Functions

### `create-asaas-payment`
**Purpose**: Main payment creation entry point
**Input**: Customer data, product IDs, payment method (PIX/CREDIT_CARD), coupon
**Output**: Asaas payment object + order ID
**Connections**: Creates user (Auth+Profile), creates order, calls Asaas API
**Common Issues**: Foreign key violations (user creation), Asaas API failures, duplicate emails

### `asaas-webhook`
**Purpose**: Process payment confirmations from Asaas
**Input**: Webhook payload (PAYMENT_CONFIRMED/PAYMENT_RECEIVED)
**Output**: Order status update + user access grant + email sending
**Connections**: Updates order status, grants product access, sends Resend email, Meta CAPI tracking
**Common Issues**: Missing user profiles, duplicate webhook processing, email template failures

## User Management Core Functions

### `create-customer`
**Purpose**: Manual user creation (admin use)
**Input**: name, email, cpf, whatsapp
**Output**: New Auth user + Profile
**Connections**: Creates Auth user first, then Profile, validates duplicates
**Common Issues**: Email/CPF duplicates, Auth-Profile sync failures

### `admin-update-user`
**Purpose**: Admin user profile updates
**Input**: userId + update fields + admin auth token
**Output**: Updated profile + optional Auth email update
**Connections**: Validates admin permissions, updates Profile table, updates Auth if email changed
**Common Issues**: Unauthorized access attempts, Auth update failures

### `admin-delete-user`
**Purpose**: Complete user deletion (admin use)
**Input**: userId + admin auth token
**Output**: Deleted user (Auth + Profile + Orders)
**Connections**: Deletes orders, profile, then Auth user
**Common Issues**: Foreign key constraints, incomplete cleanup

## Utility Core Functions

### `calculate-installments`
**Purpose**: Calculate payment installments with fallback
**Input**: totalPrice
**Output**: Array of installment options
**Connections**: Pure calculation, no DB calls
**Common Issues**: Invalid price values, minimum installment validation

### `check-payment-status`
**Purpose**: Query Asaas payment status
**Input**: payment_id
**Output**: Payment status string
**Connections**: Asaas API only
**Common Issues**: Invalid payment IDs, Asaas API downtime

## Diagnostic Functions

### `diagnose-user-issue`
**Purpose**: Comprehensive user troubleshooting
**Input**: email, userId
**Output**: Full diagnostic report
**Connections**: Queries Auth, Profiles, Logs tables
**Common Issues**: Data inconsistencies, missing records

### `force-create-user`
**Purpose**: Emergency user creation bypassing normal flow
**Input**: user data + forceMode flag
**Output**: User created via multiple strategies
**Connections**: Uses UPSERT, raw SQL, timestamp UUID generation
**Common Issues**: Supabase bugs, constraint violations, timing issues

## Shared Services

### `_shared/user.service`
**Purpose**: User creation/lookup logic
**Strategy**: Auth-first approach for foreign key compliance
**Features**: User creation/lookup with retry logic

### `_shared/order.service`
**Purpose**: Order validation and creation
**Features**: Product validation, coupon application, order creation

### `_shared/asaas.service`
**Purpose**: Asaas API integration
**Features**: PIX and credit card processing, QR code generation

## Error Patterns

**Foreign Key Violations**: Usually user creation race conditions
**Auth-Profile Sync**: Check both tables for consistency
**Asaas API**: Network issues, invalid data formats
**Webhook Idempotency**: Always check current status before updates

## Deployment Notes

- All functions use TypeScript with proper type definitions
- Comprehensive logging for debugging and monitoring
- Proper error handling with meaningful error messages
- CORS headers configured for web access
- Environment variables for API keys and configuration