/* eslint-disable */
/**
 * Hand-maintained type declarations for the Yaad shop API extension.
 *
 * Kept narrow on purpose — only the input/output shapes used by the resolver
 * and service are declared here. Regenerate via @graphql-codegen if the schema
 * in `api-extensions.ts` grows.
 */

export enum ErrorCode {
    ORDER_PAYMENT_STATE_ERROR = 'ORDER_PAYMENT_STATE_ERROR',
    INELIGIBLE_PAYMENT_METHOD_ERROR = 'INELIGIBLE_PAYMENT_METHOD_ERROR',
}

export interface YaadPaymentIntentInput {
    paymentMethodCode?: string | null;
    orderId?: string | null;
    locale?: string | null;
}

export interface YaadPaymentIntent {
    url: string;
}

export interface YaadPaymentIntentError {
    errorCode: ErrorCode;
    message: string;
}

export type YaadPaymentIntentResult = YaadPaymentIntent | YaadPaymentIntentError;
