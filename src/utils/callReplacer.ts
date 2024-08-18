import {Replacer, ReplacerArgs, ReplacerContext} from '../types';

import {stringifyAstNode} from './stringifyAstNode';

type CallReplacerArgs = Omit<ReplacerArgs, 'callArguments'>;

export function callReplacer(replacer: Replacer, context: ReplacerContext, args: CallReplacerArgs) {
    const callArguments = args.callNode.arguments.map(stringifyAstNode);

    const result = replacer.call(context, {
        ...args,
        callArguments,
    });

    if (typeof result === 'string') {
        return {
            value: result,
            key: args.key,
            keyset: args.keyset,
        };
    }

    return result;
}
