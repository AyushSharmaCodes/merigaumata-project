const mockPhoneUpsertSingle = jest.fn();
const mockPhoneUpsertSelect = jest.fn(() => ({ single: mockPhoneUpsertSingle }));
const mockPhoneUpsert = jest.fn(() => ({ select: mockPhoneUpsertSelect }));

const mockAddressInsertSingle = jest.fn();
const mockAddressInsertSelect = jest.fn(() => ({ single: mockAddressInsertSingle }));
const mockAddressInsert = jest.fn(() => ({ select: mockAddressInsertSelect }));

const mockAddressUpdateEqUser = jest.fn(() => ({ select: mockAddressInsertSelect }));
const mockAddressUpdateEqId = jest.fn(() => ({ eq: mockAddressUpdateEqUser }));
const mockAddressUpdate = jest.fn(() => ({ eq: mockAddressUpdateEqId }));

jest.mock('../lib/supabase', () => ({
    from: jest.fn((table) => {
        if (table === 'phone_numbers') {
            return { upsert: mockPhoneUpsert };
        }

        if (table === 'addresses') {
            return {
                insert: mockAddressInsert,
                update: mockAddressUpdate
            };
        }

        throw new Error(`Unexpected table: ${table}`);
    })
}));

jest.mock('../utils/phone-validator', () => ({
    validate: jest.fn(async () => ({ isValid: true }))
}));

jest.mock('../services/checkout-summary-cache.service', () => ({
    invalidateCheckoutSummaryCache: jest.fn()
}));

jest.mock('../utils/request-cache', () => ({
    rememberForRequest: jest.fn((_, factory) => factory()),
    invalidateRequestCacheByPrefix: jest.fn()
}));

const AddressService = require('../services/address.service');

describe('address phone upsert optimization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('createAddress upserts phone number in one DB write path', async () => {
        mockPhoneUpsertSingle.mockResolvedValue({
            data: { id: 'phone-1' },
            error: null
        });

        mockAddressInsertSingle.mockResolvedValue({
            data: {
                id: 'addr-1',
                user_id: 'user-1',
                phone_numbers: { phone_number: '9999999999' },
                street_address: 'Street 1',
                apartment: null,
                postal_code: '123456',
                city: 'City',
                state: 'State',
                country: 'India',
                type: 'home',
                is_primary: false
            },
            error: null
        });

        await AddressService.createAddress('user-1', {
            full_name: 'User',
            phone: '9999999999',
            address_line1: 'Street 1',
            city: 'City',
            state: 'State',
            postal_code: '123456',
            type: 'home',
            is_primary: false
        });

        expect(mockPhoneUpsert).toHaveBeenCalledWith([{
            user_id: 'user-1',
            phone_number: '9999999999',
            label: 'Mobile',
            is_primary: false
        }], {
            onConflict: 'user_id,phone_number',
            ignoreDuplicates: false
        });
    });

    test('updateAddress reuses the same phone upsert path', async () => {
        mockPhoneUpsertSingle.mockResolvedValue({
            data: { id: 'phone-1' },
            error: null
        });

        mockAddressInsertSingle.mockResolvedValue({
            data: {
                id: 'addr-1',
                user_id: 'user-1',
                phone_numbers: { phone_number: '9999999999' },
                street_address: 'Street 2',
                apartment: null,
                postal_code: '123456',
                city: 'City',
                state: 'State',
                country: 'India',
                type: 'home',
                is_primary: false
            },
            error: null
        });

        await AddressService.updateAddress('addr-1', 'user-1', {
            phone: '9999999999',
            street_address: 'Street 2'
        });

        expect(mockPhoneUpsert).toHaveBeenCalledTimes(1);
        expect(mockPhoneUpsertSelect).toHaveBeenCalledWith('id');
    });
});
