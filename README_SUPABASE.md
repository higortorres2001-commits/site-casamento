# CORE FUNCTIONS REFERENCE - AI OPTIMIZED

## PAYMENT FLOW

### create-asaas-payment
PURPOSE: Main payment entry point
INPUT: customer data, productIds, paymentMethod, coupon
OUTPUT: Asaas payment + orderId
CONNECTIONS: Creates user(Auth+Profile) → Creates order → Calls Asaas API
COMMON ISSUES: Foreign key violations, duplicate emails, Asaas API failures

### asaas-webhook
PURPOSE: Process payment confirmations
INPUT: webhook payload (PAYMENT_CONFIRMED/PAYMENT_RECEIVED)
OUTPUT: Order status updated + User access granted + Email sent
CONNECTIONS: Updates order → Grants product access → Sends Resend email → Meta CAPI
COMMON ISSUES: Missing profiles, duplicate webhooks, email template failures

## USER MANAGEMENT

### create-customer
PURPOSE: Manual user creation (admin)
INPUT: name, email, cpf, whatsapp
OUTPUT: New Auth user + Profile
CONNECTIONS: Validates duplicates → Creates Auth → Creates Profile
COMMON ISSUES: Email/CPF duplicates, Auth-Profile sync failures

### admin-update-user
PURPOSE: Admin user updates
INPUT: userId + update fields + admin token
OUTPUT: Updated profile + optional Auth email update
CONNECTIONS: Validates admin → Updates Profile → Updates Auth if email changed
COMMON ISSUES: Unauthorized attempts, Auth update failures

### admin-delete-user
PURPOSE: Complete user deletion (admin)
INPUT: userId + admin token
OUTPUT: Deleted user (Auth + Profile + Orders)
CONNECTIONS: Deletes orders → Deletes profile → Deletes Auth user
COMMON ISSUES: Foreign key constraints, incomplete cleanup

## UTILITIES

### calculate-installments
PURPOSE: Calculate payment installments
INPUT: totalPrice
OUTPUT: Installment options array
CONNECTIONS: Pure calculation, no DB
COMMON ISSUES: Invalid prices, minimum installment validation

### check-payment-status
PURPOSE: Query Asaas payment status
INPUT: payment_id
OUTPUT: Payment status string
CONNECTIONS: Asaas API only
COMMON ISSUES: Invalid IDs, API downtime

## DIAGNOSTICS

### diagnose-user-issue
PURPOSE: User troubleshooting
INPUT: email, userId
OUTPUT: Full diagnostic report
CONNECTIONS: Queries Auth, Profiles, Logs
COMMON ISSUES: Data inconsistencies, missing records

### force-create-user
PURPOSE: Emergency user creation
INPUT: user data + forceMode
OUTPUT: User via multiple strategies
CONNECTIONS: UPSERT → Raw SQL → Timestamp UUID
COMMON ISSUES: Supabase bugs, constraint violations

## SHARED SERVICES

### _shared/user.service
STRATEGY: Auth-first for foreign key compliance
FEATURES: User creation/lookup with retry logic

### _shared/order.service
FEATURES: Product validation, coupon application, order creation

### _shared/asaas.service
FEATURES: PIX/credit card processing, QR code generation

## ERROR PATTERNS

FOREIGN KEY: User creation race conditions
AUTH-PROFILE SYNC: Check both tables
ASAAS API: Network issues, invalid formats
WEBHOOK IDEMPOTENCY: Always check current status first