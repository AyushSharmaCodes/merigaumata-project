const contactService = require('../services/contact.service');
const supabase = require('../config/supabase');

jest.mock('../config/supabase', () => ({
    from: jest.fn()
}));

function createContactQuery(result) {
    const state = {
        eqCalls: [],
        orCall: null,
        rangeCall: null
    };

    const builder = {
        select: jest.fn(() => builder),
        order: jest.fn(() => builder),
        eq: jest.fn((column, value) => {
            state.eqCalls.push([column, value]);
            return builder;
        }),
        or: jest.fn((value) => {
            state.orCall = value;
            return builder;
        }),
        range: jest.fn((from, to) => {
            state.rangeCall = [from, to];
            return Promise.resolve(result);
        }),
        __state: state
    };

    return builder;
}

describe('ContactService.getAll', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('applies pagination, status filter, and normalized search', async () => {
        const query = createContactQuery({
            data: [{ id: 'msg-1', status: 'NEW' }],
            count: 23,
            error: null
        });

        supabase.from.mockReturnValue(query);

        const result = await contactService.getAll({
            page: 2,
            limit: 10,
            status: 'NEW',
            search: 'foo, %bar'
        });

        expect(supabase.from).toHaveBeenCalledWith('contact_messages');
        expect(query.eq).toHaveBeenCalledWith('status', 'NEW');
        expect(query.or).toHaveBeenCalledWith('name.ilike.%foo bar%,email.ilike.%foo bar%,message.ilike.%foo bar%');
        expect(query.range).toHaveBeenCalledWith(10, 19);
        expect(result).toEqual({
            messages: [{ id: 'msg-1', status: 'NEW' }],
            pagination: {
                page: 2,
                limit: 10,
                total: 23,
                totalPages: 3
            }
        });
    });

    test('skips search clause when normalized search is empty', async () => {
        const query = createContactQuery({
            data: [],
            count: 0,
            error: null
        });

        supabase.from.mockReturnValue(query);

        const result = await contactService.getAll({
            page: 1,
            limit: 20,
            search: ' , % , '
        });

        expect(query.or).not.toHaveBeenCalled();
        expect(result.pagination.totalPages).toBe(0);
    });
});
