/*
  # Add 'check' provider to payment gateway configs
  
  1. Changes
    - Update the provider CHECK constraint to include 'check' as a valid provider option
    - This allows the Check Payment gateway to be saved in the payment_gateway_configs table
  
  2. Purpose
    - Enable manual check payment processing alongside automated gateways
*/

-- Drop the existing constraint
ALTER TABLE payment_gateway_configs 
DROP CONSTRAINT IF EXISTS payment_gateway_configs_provider_check;

-- Add updated constraint that includes 'check'
ALTER TABLE payment_gateway_configs
ADD CONSTRAINT payment_gateway_configs_provider_check 
CHECK (provider IN ('paypal', 'xendit', 'custom', 'check'));
