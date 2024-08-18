type KeysetKey = {
    key: string;
    keyset?: string;
};

export const KEYSET_SEPARATOR = '::';

export const encodeKeysetKey = ({key, keyset}: KeysetKey) =>
    keyset ? `${keyset}${KEYSET_SEPARATOR}${key}` : key;

export const parseKeysetKey = (value: string): KeysetKey => {
    const parts = value.split(KEYSET_SEPARATOR);
    if (parts.length === 2) {
        return {
            keyset: parts[0],
            key: parts[1],
        };
    }

    return {
        key: value,
    };
};
