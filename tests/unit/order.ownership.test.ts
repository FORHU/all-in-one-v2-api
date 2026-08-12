import OrderService from '../../src/modules/commerce/order.service';

const customerOrder = { customerId: 'cust-1', sessionId: null };
const guestOrder = { customerId: null, sessionId: 'sess-abc' };

describe('OrderService.isOrderOwner', () => {
  it('recognises the customer who placed the order', () => {
    expect(OrderService.isOrderOwner(customerOrder, { customerId: 'cust-1', isAdmin: false })).toBe(
      true,
    );
  });

  it('rejects a different customer', () => {
    expect(OrderService.isOrderOwner(customerOrder, { customerId: 'cust-2', isAdmin: false })).toBe(
      false,
    );
  });

  it('recognises a guest holding the placing session', () => {
    expect(OrderService.isOrderOwner(guestOrder, { sessionId: 'sess-abc', isAdmin: false })).toBe(
      true,
    );
  });

  it('rejects a guest with a different session', () => {
    expect(OrderService.isOrderOwner(guestOrder, { sessionId: 'sess-xyz', isAdmin: false })).toBe(
      false,
    );
  });

  it('rejects a caller with no identity at all', () => {
    expect(OrderService.isOrderOwner(guestOrder, { isAdmin: false })).toBe(false);
    expect(OrderService.isOrderOwner(customerOrder, { isAdmin: false })).toBe(false);
  });

  it('does not let a null field on the order match a missing viewer field', () => {
    // Both null/undefined must never be treated as a match, or every guest
    // would own every account order.
    expect(
      OrderService.isOrderOwner({ customerId: null, sessionId: null }, { isAdmin: false }),
    ).toBe(false);
    expect(
      OrderService.isOrderOwner(
        { customerId: null, sessionId: null },
        { customerId: undefined, sessionId: undefined, isAdmin: false },
      ),
    ).toBe(false);
  });
});
