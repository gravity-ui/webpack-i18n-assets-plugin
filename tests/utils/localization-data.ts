export const localesEmpty = Object.freeze({});

const stringWithDoubleQuotes = '"double " quotes"';
const stringWithSingleQuotes = "'single ' quotes'";

export const localesMulti = Object.freeze({
    ru: {
        global: {
            app: 'Приложение',
            service: 'Сервис',
        },
        'hello-key': 'Привет',
        actions: {
            'hello-key': 'Привет',
            stringWithDoubleQuotes,
            stringWithSingleQuotes,
            keyWithParam: 'предложение с каким-то параметром = {{param}}',
            keyWithLiteralParam: 'предложение с каким-то параметром = {{literal-param}}',
            qwerty: '(ru) qwerty',
            qwertyWithParam: '(ru) qwertyWithParams = {{qwertyParam}}',
            pluralKey: [
                'первая форма (one) {{count}} {{someArg}}',
                'множественная форма (few) {{count}} {{someArg}}',
                'множественная форма (many) {{count}} {{someArg}}',
                'другая форма (zero) {{count}} {{someArg}}',
            ],
            tripleParams: '(ru) тройной перевод 1({{first}}), 2({{second}}), 3({{third}})',
        },
        someNewKeyset: {
            'hello-key': 'Hello',
            'test-key': 'Тест',
        },
        nesting: {
            open: 'Открыть',
            nestingService: '$t{global::app} $t{global::service} Вложенный: $t{open}',
            deepNesting: '$t{nestingService}',
            failedNestingWithPlural: '$t{actions::pluralKey}',
            pluralKey: [
                '$t{open} {{count}}',
                '$t{open} (few) {{count}}',
                '$t{open} {{count}}',
                '$t{open} {{count}}',
            ],
        },
    },
    en: {
        global: {
            app: 'App',
            service: 'Service',
        },
        'hello-key': 'Hello',
        actions: {
            'hello-key': 'Hello',
            stringWithDoubleQuotes,
            stringWithSingleQuotes,
            keyWithParam: 'some word and param = {{param}}',
            keyWithLiteralParam: 'some word and param = {{literal-param}}',
            qwerty: '(en) qwerty',
            qwertyWithParam: '(en) qwertyWithParams = {{qwertyParam}}',
            pluralKey: [
                'first-form {{count}} {{someArg}}',
                'second-form {{count}} {{someArg}}',
                'third-form {{count}} {{someArg}}',
                'other-form {{count}} {{someArg}}',
            ],
            tripleParams: '',
        },
        someNewKeyset: {
            'hello-key': 'Hello',
            'test-key': 'Test',
        },
        nesting: {
            open: 'Open',
            nestingService: '$t{global::app} $t{global::service} Nested: $t{open}',
            deepNesting: '$t{nestingService}',
            failedNestingWithPlural: '$t{actions::pluralKey}',
            pluralKey: [
                '$t{open} {{count}}',
                '$t{open} (few) {{count}}',
                '$t{open} {{count}}',
                '$t{open} {{count}}',
            ],
        },
    },
    es: {
        global: {
            app: 'Aplicación',
            service: 'Servicio',
        },
        'hello-key': 'Hola',
        actions: {
            'hello-key': 'Hola',
            stringWithDoubleQuotes,
            stringWithSingleQuotes,
            keyWithParam: 'some word and param = {{param}}',
            keyWithLiteralParam: 'some word and param = {{literal-param}}',
            qwerty: '(es) qwerty',
            qwertyWithParam: '(es) qwertyWithParams = {{qwertyParam}}',
            pluralKey: [
                'first-form {{count}} {{someArg}}',
                'second-form {{count}} {{someArg}}',
                'third-form {{count}} {{someArg}}',
                'other-form {{count}} {{someArg}}',
            ],
            tripleParams: '',
        },
        someNewKeyset: {
            'hello-key': 'Hola',
            'test-key': 'Test',
        },
        nesting: {
            open: 'Abierto',
            nestingService: '$t{global::app} $t{global::service} Anidado: $t{open}',
            deepNesting: '$t{nestingService}',
            failedNestingWithPlural: '$t{actions::pluralKey}',
            pluralKey: [
                '$t{open} {{count}}',
                '$t{open} (pocos) {{count}}',
                '$t{open} {{count}}',
                '$t{open} {{count}}',
            ],
        },
    },
    ja: {
        global: {
            app: 'アプリ',
            service: 'サービス',
        },
        'hello-key': 'こんにちは',
        actions: {
            'hello-key': 'こんにちは',
            stringWithDoubleQuotes,
            stringWithSingleQuotes,
            keyWithParam: 'some word and param = {{param}}',
            keyWithLiteralParam: 'some word and param = {{literal-param}}',
            qwerty: '(ja) qwerty',
            qwertyWithParam: '(ja) qwertyWithParams = {{qwertyParam}}',
            pluralKey: [
                'first-form {{count}} {{someArg}}',
                'second-form {{count}} {{someArg}}',
                'third-form {{count}} {{someArg}}',
                'other-form {{count}} {{someArg}}',
            ],
            tripleParams: '',
        },
        someNewKeyset: {
            'hello-key': 'こんにちは',
            'test-key': 'Test',
        },
        nesting: {
            open: 'オープン',
            nestingService: '$t{global::app} $t{global::service} ネストされた: $t{open}',
            deepNesting: '$t{nestingService}',
            failedNestingWithPlural: '$t{actions::pluralKey}',
            pluralKey: [
                '$t{open} {{count}}',
                '$t{open} {{count}}',
                '$t{open} {{count}}',
                '$t{open} {{count}}',
            ],
        },
    },
});
