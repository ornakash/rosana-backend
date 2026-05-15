import { YAAD_BASE_URL } from './constants';

export interface YaadCredentials {
    key: string;
    passP: string;
    masof: string;
}

export interface SignParams {
    amount: string;
    orderCode: string;
    info: string;
    clientName: string;
    email: string;
    phone: string;
    cell: string;
    pageLang: 'HEB' | 'ENG';
    /**
     * Custom fields echoed back on the callback. Yaad supports Fild1, Fild2, Fild3 (max 25 chars each).
     */
    fild1?: string;
    fild2?: string;
    fild3?: string;
}

export function buildSignUrl(creds: YaadCredentials, params: SignParams): string {
    const searchParams = new URLSearchParams({
        action: 'APISign',
        What: 'SIGN',
        KEY: creds.key,
        PassP: creds.passP,
        Masof: creds.masof,
        Amount: params.amount,
        Order: params.orderCode,
        Info: params.info,
        ClientName: params.clientName,
        cell: params.cell,
        phone: params.phone,
        email: params.email,
        MoreData: 'True',
        UTF8: 'True',
        UTF8out: 'True',
        OnlyOnApprove: 'True',
        Tash: '1',
        PageLang: params.pageLang,
        Sign: 'True',
        tmp: '7',
        ...(params.fild1 ? { Fild1: params.fild1 } : {}),
        ...(params.fild2 ? { Fild2: params.fild2 } : {}),
        ...(params.fild3 ? { Fild3: params.fild3 } : {}),
    });
    return YAAD_BASE_URL + searchParams.toString();
}

/**
 * Calls Yaad APISign with What=VERIFY, echoing all original callback params.
 * Yaad returns a querystring; success when it contains CCode=0.
 */
export async function verifyCallback(
    creds: YaadCredentials,
    callbackParams: Record<string, string>,
): Promise<{ ok: boolean; raw: string; parsed: Record<string, string> }> {
    const verifyParams: Record<string, string> = {
        ...callbackParams,
        action: 'APISign',
        What: 'VERIFY',
        KEY: creds.key,
        PassP: creds.passP,
        Masof: creds.masof,
    };
    const url = YAAD_BASE_URL + new URLSearchParams(verifyParams).toString();
    const response = await fetch(url);
    const raw = await response.text();
    const parsed = parseQueryString(raw);
    return {
        ok: parsed.CCode === '0',
        raw,
        parsed,
    };
}

export function parseQueryString(input: string): Record<string, string> {
    const result: Record<string, string> = {};
    const sp = new URLSearchParams(input);
    for (const [k, v] of sp.entries()) {
        result[k] = v;
    }
    return result;
}
