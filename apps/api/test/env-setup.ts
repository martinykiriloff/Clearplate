// Runs before every e2e suite (before AppModule is imported, so ConfigModule sees it).
process.env.NODE_ENV = 'test';
process.env.ENTITLEMENT_GRANTS = 'paid@example.com:all;scanner@example.com:barcode;unlimited@example.com:barcode';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_for_signature_checks_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.STRIPE_PRICE_BARCODE_MONTH = 'price_barcode_month';
process.env.STRIPE_PRICE_ALL_YEAR = 'price_all_year';
