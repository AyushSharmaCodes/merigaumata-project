const EventRegistrationService = require('../services/event-registration.service');
const EventCancellationService = require('../services/event-cancellation.service');
const EventService = require('../services/event.service');
const supabase = require('../config/supabase');
const emailService = require('../services/email');
const EventMessages = require('../constants/messages/EventMessages');
const EventRefundService = require('../services/event-refund.service');
const { refundPayment } = require('../utils/razorpay-helper');

// Mocks
jest.mock('../services/event-refund.service', () => ({
    initiateRefund: jest.fn(),
    markProcessing: jest.fn(),
    markSettled: jest.fn()
}));
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mocked-uuid-123')
}));

jest.mock('../config/supabase', () => ({
    from: jest.fn(),
    rpc: jest.fn()
}));

jest.mock('../services/email', () => ({
    sendEventRegistrationEmail: jest.fn().mockResolvedValue({ success: true }),
    sendEventCancellationEmail: jest.fn().mockResolvedValue({ success: true }),
    sendEventUpdateEmail: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../utils/razorpay-helper', () => ({
    capturePayment: jest.fn().mockResolvedValue({ success: true }),
    refundPayment: jest.fn().mockResolvedValue({ id: 'rfnd_test_123' }),
    fetchPayment: jest.fn()
}));

jest.mock('../services/razorpay-invoice.service', () => ({
    createInvoice: jest.fn().mockResolvedValue({
        success: true,
        invoiceId: 'inv_test_123',
        invoiceUrl: 'https://example.com/invoice',
        orderId: 'order_test_123'
    }),
    fetchInvoice: jest.fn()
}));

// Mock logger
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    pino: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe('Event Flows Unit Tests', () => {
    let mockRegs, mockEvents, mockJobs, mockRefunds;

    const createQueryMock = () => {
        const q = {
            _data: null,
            _error: null,
            _count: 0,
            
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockReturnThis(),
            lt: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            like: jest.fn().mockReturnThis(),
            ilike: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            or: jest.fn().mockReturnThis(),
            match: jest.fn().mockReturnThis(),
            single: jest.fn().mockImplementation(function() { return Promise.resolve({ data: this._data, error: this._error }); }),
            maybeSingle: jest.fn().mockImplementation(function() { return Promise.resolve({ data: this._data, error: this._error }); }),
            then: function(onFulfilled, onRejected) {
                return Promise.resolve({ data: this._data, error: this._error, count: this._count }).then(onFulfilled, onRejected);
            }
        };
        return q;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockRegs = createQueryMock();
        mockEvents = createQueryMock();
        mockJobs = createQueryMock();
        mockRefunds = createQueryMock();

        supabase.from.mockImplementation((table) => {
            if (table === 'event_registrations') return mockRegs;
            if (table === 'events') return mockEvents;
            if (table === 'event_cancellation_jobs') return mockJobs;
            if (table === 'event_refunds') return mockRefunds;
            return createQueryMock();
        });
        supabase.rpc.mockResolvedValue({ error: null });
    });

    describe('Registration Flow', () => {
        const mockEvent = { id: 'e1', title: 'Test', registration_amount: 0, capacity: 100, registrations: 0, status: 'upcoming', start_date: '2026-04-01', start_time: '10:00:00', end_time: '12:00:00', location: 'Online' };

        test('Free Event Registration: Should succeed', async () => {
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = null; return mockRegs; });
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = { registration_number: 'EVT-0001' }; return mockRegs; });
            mockRegs.insert.mockImplementationOnce(() => { mockRegs._data = { id: 'r1' }; return mockRegs; });
            mockEvents._data = mockEvent;

            const result = await EventRegistrationService.createRegistrationOrder('u1', { eventId: 'e1', fullName: 'J', email: 'j@e.com', phone: '1' });
            expect(result.success).toBe(true);
        });

        test('Paid Event Registration: Should create invoice', async () => {
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = null; return mockRegs; });
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = { registration_number: 'EVT-0001' }; return mockRegs; });
            mockRegs.insert.mockImplementationOnce(() => { mockRegs._data = { id: 'r1' }; return mockRegs; });
            mockEvents._data = { ...mockEvent, registration_amount: 1000, gst_rate: 18 };

            const result = await EventRegistrationService.createRegistrationOrder('u1', { eventId: 'e1', fullName: 'J', email: 'j@e.com', phone: '1' });
            expect(result.success).toBe(true);
            expect(result.order_id).toBe('order_test_123');
        });

        test('Capacity Check: Should throw when full', async () => {
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = null; return mockRegs; });
            mockRegs.select.mockImplementationOnce(() => { mockRegs._count = 10; return mockRegs; });
            mockEvents._data = { ...mockEvent, capacity: 10, registrations: 10 };

            await expect(EventRegistrationService.createRegistrationOrder('u1', { eventId: 'e1', fullName: 'J', email: 'j@e.com', phone: '1' })).rejects.toThrow(EventMessages.CAPACITY_FULL);
        });

        test('Deadline Check: Should throw when passed', async () => {
            mockRegs._data = null;
            mockEvents._data = { ...mockEvent, registration_deadline: '2026-03-01T00:00:00Z' };
            await expect(EventRegistrationService.createRegistrationOrder('u1', { eventId: 'e1', fullName: 'J', email: 'j@e.com', phone: '1' })).rejects.toThrow(EventMessages.REGISTRATION_CLOSED);
        });
    });

    describe('Cancellation Flow', () => {
        const mockRegistration = { id: 'r1', user_id: 'u1', event_id: 'e1', status: 'confirmed', payment_status: 'free', amount: 0, email: 'j@e.com', full_name: 'J', events: { id: 'e1', start_date: '2026-05-01', start_time: '10:00:00' } };

        test('User Cancellation (Free)', async () => {
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = mockRegistration; return mockRegs; });
            mockRegs.update.mockImplementationOnce(() => { mockRegs._error = null; return mockRegs; });
            mockRefunds._data = null;

            const result = await EventRegistrationService.cancelRegistration('u1', 'r1');
            expect(result.message).toBe(EventMessages.REGISTRATION_CANCELLED);
        });

        test('User Cancellation (Paid): Should return refund info and call services', async () => {
            const paidReg = { 
                id: 'r1', 
                user_id: 'u1', 
                event_id: 'e1', 
                status: 'confirmed', 
                payment_status: 'paid', 
                amount: 1000, 
                razorpay_payment_id: 'pay_123',
                events: { id: 'e1', start_date: '2026-05-01', start_time: '10:00:00' }
            };

            // 1. Fetch reg
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = paidReg; return mockRegs; });
            
            // 2. Refund Service Mocking
            EventRefundService.initiateRefund.mockResolvedValueOnce({ 
                id: 'ref-db-123', 
                status: 'INITIATED', 
                amount: 1000 
            });
            EventRefundService.markProcessing.mockResolvedValueOnce({ 
                id: 'ref-db-123', 
                status: 'PROCESSING', 
                gateway_reference: 'rfnd_razor_123' 
            });

            // 3. Update registration status
            mockRegs.update.mockImplementationOnce(() => { mockRegs._error = null; return mockRegs; });
            
            // 4. Fetch refund for response
            mockRefunds._data = { 
                id: 'ref-db-123', 
                status: 'PROCESSING', 
                amount: 1000, 
                gateway_reference: 'rfnd_razor_123' 
            };

            const result = await EventRegistrationService.cancelRegistration('u1', 'r1');

            // Verifications
            expect(EventRefundService.initiateRefund).toHaveBeenCalledWith(expect.objectContaining({
                registrationId: 'r1',
                amount: 1000
            }));
            expect(refundPayment).toHaveBeenCalledWith('pay_123', null, expect.any(Object));
            expect(result.refund.refundId).toBe('rfnd_razor_123');
        });

        test('Deadline Check: Block within 24h', async () => {
            const nearReg = JSON.parse(JSON.stringify(mockRegistration));
            nearReg.events.start_date = new Date(Date.now() + 12*36*100000).toISOString(); // > 24h? Wait
            nearReg.events.start_date = new Date(Date.now() + 12*60*60*1000).toISOString(); // 12h
            mockRegs.single.mockResolvedValueOnce({ data: nearReg });
            await expect(EventRegistrationService.cancelRegistration('u1', 'r1')).rejects.toThrow(EventMessages.CANCELLATION_DEADLINE_EXCEEDED);
        });
    });

    describe('Admin Actions', () => {
        test('Cancel Event', async () => {
            mockEvents.update.mockImplementationOnce(() => { mockEvents._data = { id: 'e1' }; return mockEvents; });
            mockRegs.select.mockImplementationOnce(() => { mockRegs._count = 5; return mockRegs; });
            mockJobs.insert.mockImplementationOnce(() => { mockJobs._data = { id: 'job-1' }; return mockJobs; });

            const result = await EventCancellationService.cancelEvent('e1', 'a1', 'R', 'c');
            expect(result.jobId).toBe('job-1');
        });

        test('Process Job', async () => {
            mockJobs.update.mockImplementationOnce(() => { mockJobs._data = { id: 'j1', event_id: 'e1', status: 'IN_PROGRESS', total_registrations: 2, batch_size: 50 }; return mockJobs; });
            mockEvents.select.mockImplementationOnce(() => { mockEvents._data = { id: 'e1', title: 'T' }; return mockEvents; });
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = [{ id: 'r1', status: 'confirmed' }]; return mockRegs; });
            await EventCancellationService.processJob('j1');
            expect(emailService.sendEventCancellationEmail).toHaveBeenCalled();
        });

        test('Reschedule Notification', async () => {
            mockEvents.select.mockImplementationOnce(() => { mockEvents._data = { id: 'e1', start_date: '2026-04-01', start_time: '10:00:00', end_time: '12:00:00' }; return mockEvents; });
            mockEvents.update.mockImplementationOnce(() => { mockEvents._data = { id: 'e1', start_date: '2026-05-01' }; return mockEvents; });
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = [{ id: 'r1', email: 't@e.com' }]; return mockRegs; });
            await EventService.updateEvent('e1', { startDate: '2026-05-01', startTime: '10:00:00', endTime: '12:00:00' });
            await new Promise(r => setTimeout(r, 50));
            expect(emailService.sendEventUpdateEmail).toHaveBeenCalled();
        });
    });
});
