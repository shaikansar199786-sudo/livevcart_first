<?php
// api/controllers/PrintTokenHelper.php
// Generates and validates short-lived, quote-scoped HMAC tokens for the Puppeteer print route.
// Tokens are NOT stored in DB — they are stateless HMAC signatures with an embedded expiry.

class PrintTokenHelper {
    private static $secret;
    private static $ttl = 300; // 5 minutes

    private static function getSecret(): string {
        if (!defined('PRINT_TOKEN_SECRET')) {
            throw new Exception('PRINT_TOKEN_SECRET is not defined in database.php');
        }
        return PRINT_TOKEN_SECRET;
    }

    /**
     * Generate a token for a specific quote_id.
     * Format: base64url( quoteId . ":" . timestamp . ":" . hmac )
     * The token is bound to the quote_id and expires in 5 minutes.
     */
    public static function generate($quote_id): string {
        $secret    = self::getSecret();
        $timestamp = time();
        $payload   = (string)$quote_id . ':' . $timestamp;
        $hmac      = hash_hmac('sha256', $payload, $secret);
        $raw       = $payload . ':' . $hmac;
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    /**
     * Validate a token against an expected quote_id.
     * Returns true only if:
     *   - The token is well-formed
     *   - The HMAC matches (not tampered)
     *   - The embedded quote_id matches the expected quote_id
     *   - The token was issued within the last 5 minutes
     */
    public static function validate(string $token, $expected_quote_id): bool {
        try {
            $secret  = self::getSecret();
            // Decode base64url
            $padded  = str_pad(strtr($token, '-_', '+/'), strlen($token) + (4 - strlen($token) % 4) % 4, '=');
            $raw     = base64_decode($padded, true);
            if ($raw === false) return false;

            $parts = explode(':', $raw, 3);
            if (count($parts) !== 3) return false;

            [$quote_id_str, $timestamp_str, $provided_hmac] = $parts;

            $timestamp = intval($timestamp_str);

            // Check quote_id matches
            if ((string)$quote_id_str !== (string)$expected_quote_id) return false;

            // Check token not expired
            if ((time() - $timestamp) > self::$ttl) return false;

            // Check HMAC match
            $expected_payload = $quote_id_str . ':' . $timestamp_str;
            $expected_hmac    = hash_hmac('sha256', $expected_payload, $secret);

            return hash_equals($expected_hmac, $provided_hmac);
        } catch (Exception $e) {
            return false;
        }
    }
}
