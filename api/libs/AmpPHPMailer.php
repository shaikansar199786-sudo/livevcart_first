<?php
// api/libs/AmpPHPMailer.php

require_once __DIR__ . '/PHPMailer/src/Exception.php';
require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;

class AmpPHPMailer extends PHPMailer
{
    /**
     * AMP HTML message body (text/x-amp-html)
     * @var string
     */
    public $AmpBody = '';

    /**
     * Override createBody to inject text/x-amp-html into multipart/alternative
     */
    public function createBody()
    {
        if (empty($this->AmpBody)) {
            return parent::createBody();
        }

        $body = '';
        $this->setBoundaries();
        $this->setWordWrap();

        $bodyEncoding = $this->Encoding;
        $bodyCharSet = $this->CharSet;
        if ($this->UseSMTPUTF8) {
            $bodyEncoding = static::ENCODING_8BIT;
        } elseif (static::ENCODING_8BIT === $bodyEncoding && !$this->has8bitChars($this->Body)) {
            $bodyEncoding = static::ENCODING_7BIT;
            $bodyCharSet = static::CHARSET_ASCII;
        }

        $altBodyEncoding = $this->Encoding;
        $altBodyCharSet = $this->CharSet;
        if (static::ENCODING_8BIT === $altBodyEncoding && !$this->has8bitChars($this->AltBody)) {
            $altBodyEncoding = static::ENCODING_7BIT;
            $altBodyCharSet = static::CHARSET_ASCII;
        }

        if ($this->sign_key_file) {
            $this->Encoding = $bodyEncoding;
            $body .= $this->getMailMIME() . static::$LE;
        }

        $mimepre = '';

        switch ($this->message_type) {
            case 'alt':
                $body .= $mimepre;
                // 1. text/plain
                $body .= $this->getBoundary(
                    $this->boundary[1],
                    $altBodyCharSet,
                    static::CONTENT_TYPE_PLAINTEXT,
                    $altBodyEncoding
                );
                $body .= $this->encodeString($this->AltBody, $altBodyEncoding);
                $body .= static::$LE;

                // 2. text/x-amp-html (AMP for Email must come after text/plain and before text/html)
                $body .= $this->getBoundary(
                    $this->boundary[1],
                    $bodyCharSet,
                    'text/x-amp-html',
                    $bodyEncoding
                );
                $body .= $this->encodeString($this->AmpBody, $bodyEncoding);
                $body .= static::$LE;

                // 3. text/html (fallback)
                $body .= $this->getBoundary(
                    $this->boundary[1],
                    $bodyCharSet,
                    static::CONTENT_TYPE_TEXT_HTML,
                    $bodyEncoding
                );
                $body .= $this->encodeString($this->Body, $bodyEncoding);
                $body .= static::$LE;

                $body .= $this->endBoundary($this->boundary[1]);
                break;

            case 'alt_attach':
                $body .= $mimepre;
                $body .= $this->textLine('--' . $this->boundary[1]);
                $body .= $this->headerLine('Content-Type', static::CONTENT_TYPE_MULTIPART_ALTERNATIVE . ';');
                $body .= $this->textLine(' boundary="' . $this->boundary[2] . '"');
                $body .= static::$LE;

                // 1. text/plain
                $body .= $this->getBoundary(
                    $this->boundary[2],
                    $altBodyCharSet,
                    static::CONTENT_TYPE_PLAINTEXT,
                    $altBodyEncoding
                );
                $body .= $this->encodeString($this->AltBody, $altBodyEncoding);
                $body .= static::$LE;

                // 2. text/x-amp-html
                $body .= $this->getBoundary(
                    $this->boundary[2],
                    $bodyCharSet,
                    'text/x-amp-html',
                    $bodyEncoding
                );
                $body .= $this->encodeString($this->AmpBody, $bodyEncoding);
                $body .= static::$LE;

                // 3. text/html
                $body .= $this->getBoundary(
                    $this->boundary[2],
                    $bodyCharSet,
                    static::CONTENT_TYPE_TEXT_HTML,
                    $bodyEncoding
                );
                $body .= $this->encodeString($this->Body, $bodyEncoding);
                $body .= static::$LE;

                $body .= $this->endBoundary($this->boundary[2]);
                $body .= static::$LE;
                $body .= $this->attachAll('attachment', $this->boundary[1]);
                break;

            case 'alt_inline':
                $body .= $mimepre;
                // 1. text/plain
                $body .= $this->getBoundary(
                    $this->boundary[1],
                    $altBodyCharSet,
                    static::CONTENT_TYPE_PLAINTEXT,
                    $altBodyEncoding
                );
                $body .= $this->encodeString($this->AltBody, $altBodyEncoding);
                $body .= static::$LE;

                // 2. text/x-amp-html
                $body .= $this->getBoundary(
                    $this->boundary[1],
                    $bodyCharSet,
                    'text/x-amp-html',
                    $bodyEncoding
                );
                $body .= $this->encodeString($this->AmpBody, $bodyEncoding);
                $body .= static::$LE;

                // 3. multipart/related with text/html
                $body .= $this->textLine('--' . $this->boundary[1]);
                $body .= $this->headerLine('Content-Type', static::CONTENT_TYPE_MULTIPART_RELATED . ';');
                $body .= $this->textLine(' boundary="' . $this->boundary[2] . '";');
                $body .= $this->textLine(' type="' . static::CONTENT_TYPE_TEXT_HTML . '"');
                $body .= static::$LE;
                $body .= $this->getBoundary(
                    $this->boundary[2],
                    $bodyCharSet,
                    static::CONTENT_TYPE_TEXT_HTML,
                    $bodyEncoding
                );
                $body .= $this->encodeString($this->Body, $bodyEncoding);
                $body .= static::$LE;
                $body .= $this->attachAll('inline', $this->boundary[2]);
                $body .= static::$LE;
                $body .= $this->endBoundary($this->boundary[1]);
                break;

            default:
                return parent::createBody();
        }

        return $body;
    }
}
