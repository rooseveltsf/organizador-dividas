import { addMonths, batchCreateTransactionSchema, calendarDay, createTransactionSchema, installmentCents,
  parseCalendarDate, shoppingItemSchema, shoppingPurchaseCandidate, shoppingPurchaseSchema, toCents, transactionCount,
  updateTransactionSchema, type CreateProfileDTO, type CreateTransactionDTO, type Profile,
  type ShoppingItem, type ShoppingItemInput, type Transaction } from '@organizador/shared';
import { ApiError } from '../api';
import { shiftMonth } from '../calendar';
import type { ProfileSource } from '../contexts/ProfileContext';
import { EXAMPLE_PROFILE, type GuideScene } from './GuideContext';
import type { Lesson } from './chapters';
import { examplePayslip } from './examplePayslip';

const defaultProfile: Profile = { id: 'guide-profile', name: EXAMPLE_PROFILE, avatarInitials: 'CE',
  primaryColor: '#244e42', secondaryColor: '#abb8a2', hasPin: false };
const demoToken = 'guide-session';

export function exampleNotebook(preset: Lesson['scene'] = {}, lightHistory?: { saved?: Transaction }) {
  const month = calendarDay(new Date()).slice(0, 7);
  const today = month + '-05';
  const date = (day: string, offset = 0) => shiftMonth(month, offset) + '-' + day;
  const profileId = defaultProfile.id;
  const withPin = preset.access === 'protected' || preset.access === 'unlock';
  const profiles = new Map<string, Profile>();
  const pins = new Map<string, string>();
  if (preset.access !== 'empty') profiles.set(profileId, { ...defaultProfile, hasPin: withPin });
  if (withPin) pins.set(profileId, '1234');
  if (preset.access === 'directory') {
    ['Ana', 'Bruno', 'Casa', 'Família', 'Trabalho', 'Viagem'].forEach((name, index) => {
      const id = 'guide-cover-' + index;
      profiles.set(id, { ...defaultProfile, id, name, avatarInitials: name.charAt(0) });
    });
  }

  function makeRows(input: CreateTransactionDTO): Transaction[] {
    const count = transactionCount(input, input.repeatMonths ?? 1);
    const installment = input.category === 'installment';
    const first = input.currentInstallment ?? 1;
    const total = input.totalInstallments ?? 1;
    const groupId = count > 1 || installment ? crypto.randomUUID() : null;
    return Array.from({ length: count }, (_, index) => {
      const day = addMonths(parseCalendarDate(input.date), index).toISOString().slice(0, 10);
      const status = index ? 'pending' : input.status ?? 'pending';
      return { id: crypto.randomUUID(), profileId: input.profileId, description: input.description,
        type: input.type, category: input.category, amount: input.amountMode === 'total'
          ? installmentCents(toCents(input.amount), total, first + index) / 100 : input.amount,
        date: day, status, paymentDate: status === 'paid' ? input.paymentDate ?? day : null,
        groupId, currentInstallment: installment ? first + index : null, totalInstallments: installment ? total : null };
    });
  }
  const seed = (description: string, amount: number, category: Transaction['category'], due: string,
    options?: Partial<CreateTransactionDTO>) => makeRows({ profileId, description, amount, category, date: due, type: 'expense', ...options });
  const installments = seed('Celular', 210, 'installment', date('15'), { currentInstallment: 1, totalInstallments: 4 });
  const light = lightHistory?.saved?.date.startsWith(month) ? { ...lightHistory.saved } :
    { ...seed('Conta de luz', 148.32, 'daily', date('10'))[0], id: 'guide-light' };
  const rows = new Map<string, Transaction>();
  function insert(entries: Transaction[]) {
    entries.forEach(row => rows.set(row.id, row));
    return entries;
  }
  insert([...installments,
    ...seed('Salário', 2500, 'fixed', date('05'), { type: 'income', status: 'paid', repeatMonths: 4 }),
    ...seed('Aluguel', 950, 'fixed', date('08'), { repeatMonths: 3 }),
    ...seed('Assinatura', 39.90, 'recurring', date('15'), { repeatMonths: 2 })]);
  if (preset.light !== 'absent') {
    const paid = preset.light === 'paid';
    insert([{ ...light, status: paid ? 'paid' : 'pending', paymentDate: paid ? today : null }]);
  }

  const items = new Map<string, ShoppingItem>();
  function makeItem(id: string, input: ShoppingItemInput, owner = profileId): ShoppingItem {
    return { ...shoppingItemSchema.parse(input), id, profileId: owner, createdAt: today,
      purchasedAt: null, archivedAt: null, actualAmount: null, actualPaymentMethod: null,
      actualInstallmentCount: null, actualDate: null, transactionId: null, groupId: null };
  }
  const shopping = {
    cash: makeItem('cash', { name: 'Luminária', estimatedAmount: 85, paymentMethod: 'cash', scheduledDate: date('12') }),
    installments: makeItem('installments', { name: 'Fone', estimatedAmount: 240, paymentMethod: 'installments',
      installmentCount: 3, scheduledDate: date('15') }),
    incomplete: makeItem('incomplete', { name: 'Mochila' }),
  };
  for (const item of Object.values(shopping)) items.set(item.id, item);
  items.set('archived', { ...makeItem('archived', { name: 'Garrafa' }), archivedAt: today });
  const payslip = examplePayslip(month);
  let simulateFailure = Boolean(preset.retry);
  const scene: GuideScene = { ...preset, today, installment: installments[0], shopping, payslip,
    recover: preset.retry ? () => { simulateFailure = false; } : undefined };

  function retryableRead(view: typeof preset.view | 'profiles', error: string) {
    const failedView = preset.access === 'cover' ? 'profiles' : preset.view ?? 'statement';
    if (simulateFailure && view === failedView) throw new Error(error);
  }

  const source: ProfileSource = {
    readSelection: () => preset.access === 'cover' || preset.access === 'directory' || preset.access === 'empty' ? { id: null }
      : { id: profileId, ...(preset.access === 'protected' && { session: { profileId, token: demoToken } }) },
    saveSelection: () => {},
    async request<T>(path: string, error: string, init?: RequestInit, token?: string): Promise<T | undefined> {
      await Promise.resolve();
      if (init?.signal?.aborted) throw new Error(error);
      const [pathname, query = ''] = path.split('?');
      const params = new URLSearchParams(query);
      const [resource, id, action, itemId, itemAction] = pathname.slice(1).split('/').map(decodeURIComponent);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      const response = (value: unknown) => value as T;
      if (resource === 'profiles') {
        if (!id && method === 'GET') {
          retryableRead('profiles', error);
          return response([...profiles.values()]);
        }
        if (!id && method === 'POST') {
          const input = body as CreateProfileDTO;
          const id = crypto.randomUUID();
          const created: Profile = { ...defaultProfile, id, name: input.name, primaryColor: input.primaryColor,
            secondaryColor: input.secondaryColor, avatarInitials: input.avatarInitials || input.name.slice(0, 2).toUpperCase(),
            hasPin: Boolean(input.pin) };
          if (input.pin) pins.set(id, input.pin);
          profiles.set(id, created);
          return response(created);
        }
        const profile = profiles.get(id);
        if (!profile) throw new Error(error);
        if (action === 'session') {
          if (method === 'DELETE') return;
          if (method === 'POST' && pins.get(id) !== body.pin) throw new Error('PIN incorreto. Confira os quatro dígitos.');
          if (profile.hasPin && method !== 'POST' && token !== demoToken)
            throw new ApiError('Digite o PIN para entrar.', 'PROFILE_SESSION_REQUIRED');
          return response({ profile, session: profile.hasPin
            ? { token: demoToken, expiresAt: today, expiresInMs: 60 * 60 * 1000 } : undefined });
        }
        if (action === 'pin' && method === 'PUT') {
          if (profile.hasPin && pins.get(id) !== body.currentPin) throw new Error('PIN atual incorreto.');
          if (body.pin) pins.set(id, body.pin);
          else pins.delete(id);
          const updated = { ...profile, hasPin: Boolean(body.pin) };
          profiles.set(id, updated);
          return response(updated);
        }
        if (action === 'shopping-list') {
          const item = itemId ? items.get(itemId) : undefined;
          if (!itemId && method === 'GET') {
            retryableRead('shopping', error);
            return response([...items.values()].filter(item => item.profileId === id));
          }
          if ((method === 'PUT' && item) || (!itemId && method === 'POST')) {
            const next = item ? { ...item, ...shoppingItemSchema.parse(body) } : makeItem(crypto.randomUUID(), body, id);
            items.set(next.id, next);
            return response(next);
          }
          if (!item || item.profileId !== id) throw new Error(error);
          if (itemAction === 'archive') {
            const next = { ...item, archivedAt: today };
            items.set(item.id, next);
            return response(next);
          }
          if (itemAction === 'transaction') {
            const row = item.transactionId ? rows.get(item.transactionId) : undefined;
            if (!row) throw new Error(error);
            return response({ id: row.id, date: row.date });
          }
          if (itemAction === 'complete' && !item.purchasedAt && !item.archivedAt) {
            const purchase = shoppingPurchaseSchema.parse(shoppingPurchaseCandidate(item, body));
            const cash = purchase.paymentMethod === 'cash';
            const [first] = insert(makeRows({ profileId: id, description: item.name, amount: purchase.amount,
              type: 'expense', category: cash ? 'daily' : 'installment', date: purchase.date,
              status: cash ? 'paid' : 'pending', amountMode: cash ? 'unit' : 'total',
              totalInstallments: purchase.installmentCount }));
            const next = { ...item, purchasedAt: today, actualAmount: purchase.amount, actualDate: purchase.date,
              actualPaymentMethod: purchase.paymentMethod, actualInstallmentCount: purchase.installmentCount,
              transactionId: first.id, groupId: first.groupId ?? null };
            items.set(item.id, next);
            return response(next);
          }
          if (!itemAction && method === 'GET') return response(item);
        }
        if (!action && method === 'DELETE') {
          if (profile.hasPin && pins.get(id) !== body.currentPin) throw new Error('PIN atual incorreto.');
          profiles.delete(id);
          pins.delete(id);
          for (const [key, row] of rows) if (row.profileId === id) rows.delete(key);
          for (const [key, item] of items) if (item.profileId === id) items.delete(key);
          return;
        }
      }
      if (resource === 'transactions') {
        if (method === 'GET' && !id) {
          retryableRead(params.has('month') ? 'statement' : params.has('startDate') ? 'future' : 'purchase', error);
          const selectedPeriod = params.has('month') ? params.get('year') + '-' + params.get('month')?.padStart(2, '0') : '';
          const start = params.get('startDate');
          const type = params.get('type');
          return response([...rows.values()].filter(row => row.profileId === params.get('profileId') &&
            row.date.startsWith(selectedPeriod) && (!start || row.date >= start) && (!type || row.type === type)));
        }
        if (method === 'POST' && id === 'batch') {
          const batch = batchCreateTransactionSchema.parse(body);
          const created = insert(batch.transactions.flatMap(item => makeRows({ ...item, profileId: batch.profileId,
            repeatMonths: batch.repeatMonths ?? item.repeatMonths ?? 1 })));
          return response({ totalCreated: created.length });
        }
        if (method === 'POST' && !id) {
          const input = createTransactionSchema.parse(body);
          const isLight = lightHistory && preset.light === 'absent' && input.description === 'Conta de luz' &&
            input.date === date('10') && input.amount === 148.32 && input.category === 'daily';
          const created = makeRows(input);
          if (isLight) {
            created[0].id = 'guide-light';
            lightHistory.saved = { ...created[0] };
          }
          return response(insert(created));
        }
        const row = rows.get(id);
        if (!row) throw new Error(error);
        if (method === 'PUT') {
          const next = { ...row, ...updateTransactionSchema.parse(body) };
          rows.set(id, next);
          return response(next);
        }
        if (method === 'PATCH' && action === 'status') {
          const status = body.status ?? (row.status === 'paid' ? 'pending' : 'paid');
          const next = { ...row, status, paymentDate: status === 'paid' ? today : null };
          rows.set(id, next);
          return response(next);
        }
        if (method === 'DELETE') {
          rows.delete(id);
          if (params.has('deleteAll') && row.groupId) {
            for (const [key, other] of rows) if (other.groupId === row.groupId && other.date >= row.date) rows.delete(key);
          }
          return;
        }
      }
      if (resource === 'payslip' && id === 'parse' && payslip) return response(payslip.data);
      throw new Error(error);
    },
  };
  return { source, scene };
}
