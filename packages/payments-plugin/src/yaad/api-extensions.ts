import { gql } from 'graphql-tag';

export const shopApiExtensions = gql`
    input YaadPaymentIntentInput {
        """
        The code of the Vendure payment method to use. Must use the Yaad payment handler.
        Defaults to the first method with the Yaad handler if not provided.
        """
        paymentMethodCode: String
        """
        Build a payment intent for a specific order. Defaults to the active order for the session.
        """
        orderId: String
        """
        Locale to echo back via Fild1 so the callback can redirect to the right storefront URL.
        """
        locale: String
    }

    type YaadPaymentIntent {
        """
        Signed Yaad hosted-payment URL. The storefront should redirect the customer to this URL.
        """
        url: String!
    }

    type YaadPaymentIntentError implements ErrorResult {
        errorCode: ErrorCode!
        message: String!
    }

    union YaadPaymentIntentResult = YaadPaymentIntent | YaadPaymentIntentError

    extend type Mutation {
        createYaadPaymentIntent(input: YaadPaymentIntentInput!): YaadPaymentIntentResult!
    }
`;
