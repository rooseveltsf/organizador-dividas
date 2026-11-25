const assert = require('node:assert/strict');
const { test } = require('node:test');
const { collectPurchaseSeries, simulatePurchase, simulateMonthlyPurchase } = require('@organizador/shared');

const defaults = {
  profileId: 'alfa', baseDate: '2027-11-25', horizonEnd: '2027-12-31',
  price: 100, openingBalance: 150, reserve: 10,
};

function entry(id, date, amount, fields = {}) {
  return Object.freeze({ id, description: id, date, amount, profileId: 'alfa',
    type: 'expense', status: 'pending', category: 'daily', ...fields });
}

function simulate(overrides = {}, rows = []) {
  const result = simulatePurchase({ ...defaults, ...overrides }, Object.freeze(rows));
  assert.equal(result.status, 'calculated');
  return result;
}

test('simulação exige saldo disponível explícito e aceita saldo e reserva zero', () => {
  const { openingBalance, ...withoutBalance } = defaults;
  assert.deepEqual(simulatePurchase(withoutBalance, []), {
    status: 'insufficient_data', invalidFields: ['openingBalance'], invalidTransactions: [],
  });
  const result = simulate({ openingBalance: 0, reserve: 0, confirmedCoverageEnd: defaults.horizonEnd });
  assert.equal(result.planned.outcome.status, 'does_not_fit');
  assert.equal(result.planned.outcome.bestMinimum.cents, -10_000n);
});

test('saldo inicial absorve liquidações até a data-base e a projeção usa pagamentos posteriores dentro do perfil', () => {
  const rows = [
    entry('pago antecipado', '2027-12-20', 999, { status: 'paid', paymentDate: '2027-11-25' }),
    entry('pago legado', '2027-12-28', 999, { status: 'paid' }),
    entry('recebido na base', '2027-11-25', 999, { type: 'income', status: 'paid', paymentDate: '2027-11-25' }),
    entry('liquidado depois', '2027-10-02', 11.01, { status: 'paid', paymentDate: '2027-11-27T23:55:00-12:00' }),
    entry('fixa', '2027-11-26', 10, { category: 'fixed', groupId: 'service' }),
    entry('parcela', '2027-11-29', 5.32, { category: 'installment' }),
    entry('cotidiana', '2027-11-30', 4.67),
    entry('recorrente', '2027-12-01', 9, { category: 'recurring', groupId: 'service' }),
    entry('outro perfil', '2027-12-31', 999, { profileId: 'beta' }),
  ];
  const result = simulate({}, rows);
  assert.equal(result.coverage.recordsThrough, '2027-12-01');
  assert.equal(result.coverage.analyzedThrough, '2027-12-31');
  assert.deepEqual(result.planned.flows.map(flow => flow.id), ['fixa', 'liquidado depois', 'parcela', 'cotidiana', 'recorrente']);
  assert.equal(result.planned.flows[1].period, '2027-11-27');
  assert.equal(result.planned.outcome.purchase.period, '2027-11-25');
  assert.equal(result.planned.outcome.minimum.cents, 1_000n);
  assert.equal(result.planned.outcome.minimum.period, '2027-12-01');
  assert.equal(result.planned.outcome.minimum.afterExpensesIndex, 5);
});

test('a obrigação vencida entra na data-base e o déficit anterior impede indicar compra após a receita', () => {
  const rows = [
    entry('dívida antiga', '2026-05-10', 160, { status: 'overdue' }),
    entry('receita', '2027-11-25', 300, { type: 'income' }),
  ];
  const result = simulate({}, rows);
  assert.equal(result.planned.outcome.status, 'blocked');
  assert.equal(result.planned.outcome.deficit.period, defaults.baseDate);
  assert.equal(result.planned.outcome.deficit.cents, -1_000n);
  assert.equal(result.planned.flows[0].timing, 'immediate');
  const moved = simulate({ adjustments: new Map([
    ['dívida antiga', { date: '2027-12-15' }], ['receita', { income: 'expected' }],
  ]) }, rows);
  assert.equal(moved.planned.outcome.status, 'fits');
  assert.equal(moved.planned.outcome.minimum.cents, 5_000n);
  assert.equal(moved.planned.flows[1].timing, 'rescheduled');
});

test('um lançamento marcado como vencido requer ajuste mesmo com data cadastrada posterior à data-base', () => {
  const result = simulate({ confirmedCoverageEnd: '2027-12-31' }, [
    entry('despesa marcada vencida', '2027-12-15', 10, { status: 'overdue' }),
    entry('receita marcada vencida', '2027-12-15', 100, { type: 'income', status: 'overdue' }),
  ]);
  assert.deepEqual(result.planned.flows.map(flow => [flow.period, flow.timing]), [['2027-11-25', 'immediate']]);
  assert.equal(result.omittedIncome[0].reason, 'late');
});

test('receita atrasada precisa de nova data, receitas incertas entram só no previsto e exclusões são identificadas', () => {
  const rows = [
    entry('atrasada sem data', '2027-10-20', 1000, { type: 'income' }),
    entry('remarcada', '2027-10-25', 150, { type: 'income' }),
    entry('incerta', '2027-11-30', 120, { type: 'income' }),
    entry('ignorada', '2027-11-29', 1000, { type: 'income' }),
    entry('última conta', '2027-12-02', 80),
  ];
  const result = simulate({ openingBalance: 0, confirmedCoverageEnd: defaults.horizonEnd, adjustments: new Map([
    ['atrasada sem data', { income: 'expected' }], ['remarcada', { date: '2027-12-10', income: 'expected' }],
    ['ignorada', { income: 'excluded' }],
  ]) }, rows);
  assert.deepEqual(result.omittedIncome.map(({ id, reason }) => [id, reason]), [
    ['atrasada sem data', 'late'], ['ignorada', 'excluded'],
  ]);
  assert.equal(result.planned.outcome.status, 'fits');
  // A conta de dezembro consome o dinheiro disponível antes da receita remarcada.
  assert.equal(result.planned.outcome.purchase.period, '2027-12-11');
  assert.equal(result.planned.outcome.minimum.cents, 9_000n);
  assert.equal(result.conservative.outcome.status, 'blocked');
  assert.deepEqual(result.conservative.flows.map(flow => flow.id), ['última conta', 'remarcada']);
});

test('testa dias sem lançamentos, o saldo mínimo futuro e a ordem da compra no dia da receita', () => {
  const rows = [
    entry('receita', '2027-12-01', 100, { type: 'income' }),
    entry('conta posterior', '2027-12-12', 50),
    entry('taxa no dia da receita', '2027-12-01', 5),
  ];
  const result = simulate({ openingBalance: 150, reserve: 25 }, rows);
  assert.equal(result.planned.outcome.purchase.period, '2027-11-25');
  assert.equal(result.planned.outcome.minimum.period, '2027-12-01');
  assert.equal(result.planned.outcome.minimum.cents, 4_500n);
  const needsCredit = simulate({ openingBalance: 100, reserve: 25 }, rows);
  assert.equal(needsCredit.planned.outcome.purchase.period, '2027-12-02');
  assert.equal(needsCredit.planned.outcome.minimum.period, '2027-12-12');
  assert.equal(needsCredit.planned.outcome.minimum.cents, 4_500n);
  assert.equal(needsCredit.conservative.outcome.status, 'insufficient_data');
});

test('um crédito no último dia não financia a compra naquele dia', () => {
  const result = simulate({ openingBalance: 100 }, [entry('receita', '2027-12-31', 500, { type: 'income' })]);
  assert.equal(result.planned.outcome.status, 'does_not_fit');
  assert.equal(result.planned.outcome.bestMinimum.cents, 0n);
});

test('estimativa variável adiciona o valor inteiro no primeiro dia analisado de cada mês', () => {
  const result = simulate({ openingBalance: 150.39, additionalMonthlyExpenses: 20.15,
    confirmedCoverageEnd: '2027-12-31' }, [entry('cotidiana cadastrada', '2027-11-28', 0.09)]);
  assert.deepEqual(result.planned.flows.map(({ period, cents, timing }) => [period, cents, timing]), [
    ['2027-11-25', 2_015n, 'estimate'], ['2027-11-28', 9n, 'scheduled'], ['2027-12-01', 2_015n, 'estimate'],
  ]);
  assert.equal(result.planned.outcome.minimum.cents, 1_000n);
});

test('cobertura ausente ou parcial fica distinta de inviabilidade no horizonte completo', () => {
  assert.equal(simulate({}).planned.outcome.status, 'insufficient_data');
  const rows = [entry('conta', '2027-11-30', 50)];
  const partial = simulate({}, rows);
  assert.equal(partial.planned.outcome.status, 'insufficient_data');
  assert.equal(partial.coverage.analyzedThrough, '2027-11-30');
  const complete = simulate({ confirmedCoverageEnd: '2027-12-31' }, rows);
  assert.equal(complete.planned.outcome.status, 'does_not_fit');
  assert.equal(complete.coverage.analyzedThrough, defaults.horizonEnd);
  const negative = simulate({ openingBalance: -0.01 });
  assert.equal(negative.planned.outcome.status, 'blocked');
  assert.equal(negative.planned.outcome.deficit.cents, -1n);
});

test('períodos mensais produzem estimativa mensal, com débitos antes dos créditos e limite de meses cobertos', () => {
  const rows = [
    entry('receita mensal', '2027-11', 120, { type: 'income' }),
    entry('conta mensal', '2027-12', 25),
    entry('conta do extrato', '2027-12-15', 5),
  ];
  const result = simulate({ openingBalance: 50, horizonEnd: '2028-01-09', confirmedCoverageEnd: '2028-01-09' }, rows);
  assert.equal(result.precision, 'month');
  assert.equal(result.coverage.analyzedThrough, '2027-12-31');
  assert.equal(result.planned.outcome.purchase.period, '2027-12');
  assert.equal(result.planned.outcome.minimum.cents, 4_000n);
  assert.equal(result.conservative.outcome.status, 'insufficient_data');
});

test('datas inválidas impedem recomendação e os totais mantêm precisão além de Number', () => {
  const invalid = simulatePurchase(defaults, [entry('conta inválida', '2028-02-30', 100)]);
  assert.deepEqual(invalid, { status: 'insufficient_data', invalidFields: [], invalidTransactions: ['conta inválida'] });
  const settled = { type: 'income', status: 'paid', paymentDate: '2027-11-26' };
  const result = simulate({ openingBalance: 0, price: 0.01 }, [
    entry('primeira receita alta', '2027-11-25', 70_000_000_000_000, settled),
    entry('segunda receita alta', '2027-11-24', 70_000_000_000_000, settled),
    entry('última conta', '2027-11-27', 0.01),
  ]);
  assert.equal(result.planned.outcome.minimum.cents, 13_999_999_999_999_998n);
  assert.deepEqual(result.planned, result.conservative);
});

const seriesPeriod = { baseDate: '2028-01-15', horizonEnd: '2028-04-30', confirmedCoverageEnd: '2028-04-30' };

function installment(number, total, due, fields = {}) {
  return entry('parcela-' + number, due, 600, {
    groupId: 'financiamento', category: 'installment', currentInstallment: number, totalInstallments: total, ...fields,
  });
}

function recurrent(id, due, fields = {}) {
  return entry(id, due, 100, { groupId: 'assinatura', category: 'recurring', ...fields });
}

function recurrenceAssumption(rows, assumption, period = seriesPeriod) {
  const groups = collectPurchaseSeries(defaults.profileId, rows, period.baseDate, period.horizonEnd);
  return new Map(groups.filter(group => group.kind === 'recurrence').map(group => [group.key, assumption]));
}

test('o fim de série incompleta é só a última parcela cadastrada e outro perfil não preenche a lacuna', () => {
  const result = simulate({ ...seriesPeriod, openingBalance: 4_000 }, [
    installment(1, 3, '2028-01-02', { status: 'paid', paymentDate: '2028-01-02' }),
    installment(2, 3, '2028-02-29'),
    installment(3, 3, '2028-03-31', { profileId: 'beta' }),
  ]);
  const [series] = result.series;
  assert.equal(series.lastRegistered.id, 'parcela-2');
  assert.equal(series.lastIdentified, undefined);
  assert.deepEqual(series.missing, [{ first: 3, last: 3 }]);
  assert.equal(series.end, undefined);
  assert.equal(result.coverage.firstSeriesGap, '2028-03-01');
  assert.equal(result.coverage.analyzedThrough, '2028-02-29');
  assert.equal(result.planned.outcome.status, 'insufficient_data');
  assert.equal(result.conservative.outcome.status, 'insufficient_data');
  assert.deepEqual(result.planned.flows.map(flow => flow.id), ['parcela-2']);
});

test('a última parcela em aberto mantém o débito e adia a compra até haver caixa após o fim previsto', () => {
  const result = simulate({ ...seriesPeriod, openingBalance: 800, price: 150, reserve: 100 }, [
    installment(1, 2, '2028-01-04', { status: 'paid', paymentDate: '2028-01-03' }),
    installment(2, 2, '2028-02-21'),
    entry('receita', '2028-03-01', 500, { type: 'income', status: 'paid', paymentDate: '2028-03-01' }),
  ]);
  const [series] = result.series;
  assert.equal(series.lastIdentified.id, 'parcela-2');
  assert.equal(series.openCount, 1);
  assert.deepEqual(series.end, { period: '2028-02-21', cents: 60_000n, settled: false });
  assert.equal(result.planned.flows.find(flow => flow.id === 'parcela-2').cents, 60_000n);
  assert.equal(result.planned.outcome.purchase.period, '2028-03-02');
});

test('parcela anterior em atraso adia a quitação mesmo quando a última já está paga', () => {
  const rows = [
    installment(1, 2, '2028-01-10', { status: 'overdue' }),
    installment(2, 2, '2028-02-20', { status: 'paid', paymentDate: '2028-02-18' }),
  ];
  const input = { ...seriesPeriod, baseDate: '2028-03-05', openingBalance: 2_000 };
  const immediate = simulate(input, rows);
  assert.deepEqual(immediate.series[0].end, { period: '2028-03-05', cents: 60_000n, settled: false });
  assert.equal(immediate.planned.flows[0].timing, 'immediate');

  const adjustment = new Map([['parcela-1', { date: '2028-04-20' }]]);
  const deferred = simulate({ ...input, adjustments: adjustment }, rows);
  assert.equal(deferred.series[0].end.period, '2028-04-20');
  assert.equal(deferred.planned.flows[0].period, '2028-04-20');
  assert.equal(deferred.series[0].lastIdentified.id, 'parcela-2');
  assert.equal(deferred.series[0].end.settled, false);

  const paid = installment(1, 2, '2028-01-10', { status: 'paid', paymentDate: '2028-03-02' });
  assert.deepEqual(simulate(input, [paid, rows[1]]).series[0].end, { period: '2028-03-02', cents: 60_000n, settled: true });
  const undated = installment(1, 2, '2028-01-10', { status: 'paid' });
  assert.equal(simulate(input, [undated, rows[1]]).series[0].end, undefined);
});

test('vencimento editado prevalece no caixa e pode ser posterior ao da última parcela numerada', () => {
  const rows = [
    installment(1, 2, '2028-04-19T23:30:00-03:00'),
    installment(2, 2, '2028-02-10'),
  ];
  const result = simulate({ ...seriesPeriod, openingBalance: 4_000 }, rows);
  const [series] = result.series;
  assert.equal(series.lastRegistered.id, 'parcela-1');
  assert.equal(series.lastIdentified.id, 'parcela-2');
  assert.equal(series.end.period, '2028-04-19');
  assert.deepEqual(result.planned.flows.map(({ id, period }) => [id, period]), [
    ['parcela-2', '2028-02-10'], ['parcela-1', '2028-04-19'],
  ]);
  assert.equal(series.transactions[1].date, rows[0].date);
});

test('uma parcela removida invalida a quitação sem apagar as evidências da última parcela identificada', () => {
  const rows = [
    installment(1, 3, '2028-01-04', { status: 'paid', paymentDate: '2028-01-04' }),
    installment(2, 3, '2028-02-04'),
    installment(3, 3, '2028-03-04'),
  ];
  const input = { ...seriesPeriod, openingBalance: 4_000 };
  assert.equal(simulate(input, rows).series[0].incomplete, false);
  const result = simulate(input, rows.filter(row => row.id !== 'parcela-2'));
  assert.equal(result.series[0].lastIdentified.id, 'parcela-3');
  assert.equal(result.series[0].incomplete, true);
  assert.deepEqual(result.series[0].missing, [{ first: 2, last: 2 }]);
  assert.deepEqual(result.series[0].transactions.map(row => row.id), ['parcela-1', 'parcela-3']);
  assert.equal(result.series[0].consideredDates.get('parcela-3'), '2028-03-04');
  assert.equal(result.series[0].end, undefined);
  assert.equal(result.coverage.firstSeriesGap, '2028-02-01');
});

test('o último mês gerado de uma assinatura limita a cobertura até indicação de fim ou de continuidade', () => {
  const period = { ...seriesPeriod, baseDate: '2028-02-01' };
  const rows = [recurrent('janeiro', '2028-01-31', { status: 'paid', paymentDate: '2028-01-31' }),
    recurrent('fevereiro', '2028-02-29'), entry('outra conta', '2028-04-10', 10)];
  const input = { ...period, openingBalance: 2_000 };
  const result = simulate(input, rows);
  assert.deepEqual(result.series[0].gap, { month: '2028-03', reason: 'projection_end' });
  assert.equal(result.coverage.analyzedThrough, '2028-02-29');
  assert.equal(result.planned.outcome.status, 'insufficient_data');

  const end = { mode: 'end', date: '2028-03-31' };
  const confirmed = simulate({ ...input, recurrenceAssumptions: recurrenceAssumption(rows, end, period) }, rows);
  assert.deepEqual(confirmed.series[0].assumption, end);
  assert.equal(confirmed.coverage.analyzedThrough, '2028-04-30');
  assert.deepEqual(confirmed.planned.flows.filter(flow => flow.timing === 'assumed_recurrence').map(flow => flow.period), ['2028-03-29']);

  const continued = simulate({ ...input, recurrenceAssumptions: recurrenceAssumption(rows, { mode: 'continue' }, period) }, rows);
  assert.equal(continued.planned.outcome.status, 'fits');
  assert.deepEqual(continued.planned.flows.filter(flow => flow.timing === 'assumed_recurrence').map(flow => flow.period), ['2028-03-29', '2028-04-29']);
  assert.equal(continued.planned.outcome.minimum.cents, 159_000n);
  assert.deepEqual(continued.series[0].transactions, rows.slice(0, 2));
});

test('mudança de data da recorrência e lacuna no meio da série continuam faltantes com a premissa de continuidade', () => {
  const rows = [recurrent('janeiro', '2028-01-30'), recurrent('editada', '2028-03-11'), recurrent('março', '2028-03-30')];
  const result = simulate({ ...seriesPeriod, openingBalance: 2_000,
    recurrenceAssumptions: recurrenceAssumption(rows, { mode: 'continue' }) }, rows);
  assert.deepEqual(result.series[0].gap, { month: '2028-02', reason: 'missing_month' });
  assert.equal(result.series[0].consideredDates.get('editada'), '2028-03-11');
  assert.equal(result.planned.outcome.status, 'insufficient_data');
  assert.deepEqual(result.planned.flows.map(flow => flow.id), ['janeiro']);
  const invalid = simulatePurchase({ ...defaults, ...seriesPeriod,
    recurrenceAssumptions: recurrenceAssumption(rows, { mode: 'end', date: '2028-02-15' }) }, rows);
  assert.equal(invalid.status, 'insufficient_data');
  assert.deepEqual(invalid.invalidSeries, ['março']);
});

test('continuidade de salário respeita o cenário e o vínculo de cada perfil', () => {
  const rows = [recurrent('salário', '2028-01-20', { groupId: 'salario', amount: 400, type: 'income', category: 'fixed' }),
    recurrent('outro salário', '2028-03-20', { groupId: 'salario', type: 'income', profileId: 'beta' })];
  const input = { ...seriesPeriod, recurrenceAssumptions: recurrenceAssumption(rows, { mode: 'continue' }) };
  const uncertain = simulate(input, rows);
  assert.equal(uncertain.series[0].transactions.length, 1);
  assert.equal(uncertain.planned.flows.filter(flow => flow.timing === 'assumed_recurrence').length, 3);
  assert.deepEqual(uncertain.conservative.flows, []);
  const expected = simulate({ ...input, adjustments: new Map([['salário', { income: 'expected' }]]) }, rows);
  assert.deepEqual(expected.planned.flows, expected.conservative.flows);
});

test('lacuna anterior à data-base aparece no histórico de uma recorrência que voltou a ter lançamentos', () => {
  const result = simulate({ baseDate: '2028-03-01', horizonEnd: '2028-04-30', openingBalance: 2_000 }, [
    recurrent('janeiro', '2028-01-30', { status: 'paid', paymentDate: '2028-01-30' }),
    recurrent('março', '2028-03-30'), recurrent('abril', '2028-04-30'),
  ]);
  assert.equal(result.series[0].firstHistoricalGap, '2028-02');
  assert.equal(result.coverage.firstSeriesGap, undefined);
  assert.equal(result.planned.outcome.status, 'fits');
});

const monthlyInput = { profileId: 'alfa', today: '2028-01-15', firstDue: '2028-01-31', total: 1200, installments: 6 };

test('sobra mensal usa a regra do Extrato, destaca fevereiro e discrimina o que já foi recebido ou pago', () => {
  const rows = Object.freeze([650, 850, 400].flatMap((amount, index) => {
    const date = `2028-0${index + 1}-03`;
    return [entry('receita-' + index, date, 1000, { type: 'income', status: index === 0 ? 'paid' : 'pending' }),
      entry('despesa-' + index, date, amount, { status: index === 0 ? 'paid' : 'pending', paymentDate: '2028-02-07' })];
  }).concat(entry('outro perfil', '2028-02-06', 900, { profileId: 'beta' })));
  const result = simulateMonthlyPurchase({ ...monthlyInput, margin: 175 }, rows);
  assert.equal(result.rows.length, 6);
  assert.deepEqual(result.rows.slice(0, 3).map(row => row.withoutPurchase), [35_000n, 15_000n, 60_000n]);
  assert.deepEqual(result.rows.slice(0, 3).map(row => row.withPurchase), [15_000n, -5_000n, 40_000n]);
  assert.deepEqual(result.rows.map(row => row.purchase), Array(6).fill(20_000n));
  assert.deepEqual(result.rows.slice(0, 3).map(row => row.belowMargin), [true, true, false]);
  assert.deepEqual(result.rows.slice(0, 2).map(row => [row.received, row.paid]), [[100_000n, 65_000n], [0n, 0n]]);
  assert.equal(result.firstNegative.month, '2028-02');
  assert.equal(result.tightest.month, '2028-02');
  assert.equal(result.rows[3].missing.length, 2);
});

test('o total real parcelado distribui centavos e preserva o dia original nos meses seguintes', () => {
  const result = simulateMonthlyPurchase({ ...monthlyInput, total: 100, installments: 3 }, []);
  assert.deepEqual(result.rows.map(row => [row.purchase, row.purchaseDate]), [
    [3334n, '2028-01-31'], [3333n, '2028-02-29'], [3333n, '2028-03-31'],
  ]);
  const moved = simulateMonthlyPurchase({ ...monthlyInput, firstDue: '2028-04-30', total: 101.01, installments: 1 }, []);
  assert.deepEqual(moved.rows.map(row => row.purchase), [0n, 0n, 0n, 10101n]);
  assert.equal(simulateMonthlyPurchase({ ...monthlyInput, total: 0.02, installments: 3 }, []), undefined);
  assert.equal(simulateMonthlyPurchase({ ...monthlyInput, firstDue: '2028-02-30' }, []), undefined);
});

test('a tabela preserva parcelas editadas, explica a saída da dívida e sinaliza recorrência sem cobertura', () => {
  const rows = [installment(1, 2, '2028-01-05', { status: 'paid', paymentDate: '2028-01-05' }),
    installment(2, 2, '2028-02-21'), recurrent('assinatura janeiro', '2028-01-31'),
    recurrent('assinatura fevereiro', '2028-02-29'),
    entry('receita março', '2028-03-15', 1000, { type: 'income' }), entry('despesa março', '2028-03-15', 300)];
  const result = simulateMonthlyPurchase(monthlyInput, rows);
  assert.deepEqual(result.relief.map(({ month, cents }) => [month, cents]), [['2028-03', 60_000n]]);
  assert.equal(result.series.find(series => series.kind === 'installment').end.period, '2028-02-21');
  assert.deepEqual(result.rows[2].missing, ['assinatura fevereiro']);
  const recurrenceAssumptions = recurrenceAssumption(rows, { mode: 'continue' });
  const continued = simulateMonthlyPurchase({ ...monthlyInput, recurrenceAssumptions }, rows);
  assert.equal(continued.rows[2].assumedExpenses, 10_000n);
  assert.equal(continued.rows[2].expenses, 30_000n);
  assert.equal(continued.rows[2].withPurchase, 40_000n);
  assert.deepEqual(continued.rows[2].missing, []);
});
