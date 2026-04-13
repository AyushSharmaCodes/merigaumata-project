const EventRegistrationService = require('../services/event-registration.service');
const EventCancellationService = require('../services/event-cancellation.service');
const EventService = require('../services/event.service');
const supabase = require('../lib/supabase');
const emailService = require('../services/email');
const EventMessages = require('../constants/messages/EventMessages');
const EventRefundService = require('../services/event-refund.service');
const { refundPayment } = require('../utils/razorpay-helper');
const { createInvoice } = require('../services/razorpay-invoice.service');

// Mocks
jest.mock('../services/event-refund.service', () => ({
    initiateRefund: jest.fn(),
    markProcessing: jest.fn(),
    markSettled: jest.fn()
}));
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mocked-uuid-123')
}));

jest.mock('../lib/supabase', () => ({
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

    const getStartTimestamp = (startDate, startTime) => {
        const start = new Date(startDate);
        const [hours, minutes] = startTime.split(':').map(Number);
        start.setHours(hours, minutes, 0, 0);
        return start.getTime();
    };

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

        test('Paid Event Registration: Should prefer transactional RPC when available', async () => {
            supabase.rpc.mockResolvedValueOnce({
                data: {
                    registration: { id: 'r1', registration_number: 'EVT-20260412-0001' },
                    event: { ...mockEvent, registration_amount: 1000, gst_rate: 18 },
                    is_free: false
                },
                error: null
            });

            const result = await EventRegistrationService.createRegistrationOrder('u1', {
                eventId: 'e1',
                fullName: 'J',
                email: 'j@e.com',
                phone: '1'
            });

            expect(supabase.rpc).toHaveBeenCalledWith('create_event_registration_intent_v1', {
                p_user_id: 'u1',
                p_event_id: 'e1',
                p_full_name: 'J',
                p_email: 'j@e.com',
                p_phone: '1'
            });
            expect(result.success).toBe(true);
            expect(result.order_id).toBe('order_test_123');
            expect(mockRegs.insert).not.toHaveBeenCalled();
        });

        test('Paid Event Registration: Should fail cleanly when invoice provider fails', async () => {
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = null; return mockRegs; });
            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = { registration_number: 'EVT-0001' }; return mockRegs; });
            mockRegs.insert.mockImplementationOnce(() => { mockRegs._data = { id: 'r1' }; return mockRegs; });
            mockEvents._data = { ...mockEvent, registration_amount: 1000, gst_rate: 18 };
            createInvoice.mockResolvedValueOnce({
                success: false,
                error: 'Razorpay invoices.create timed out'
            });

            await expect(
                EventRegistrationService.createRegistrationOrder('u1', {
                    eventId: 'e1',
                    fullName: 'J',
                    email: 'j@e.com',
                    phone: '1'
                })
            ).rejects.toThrow();
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

        test('Deadline Check: Should default to 24h before start when deadline is missing', async () => {
            mockRegs._data = null;
            const startAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
            mockEvents._data = {
                ...mockEvent,
                start_date: startAt.toISOString(),
                start_time: `${String(startAt.getHours()).padStart(2, '0')}:${String(startAt.getMinutes()).padStart(2, '0')}:00`,
                registration_deadline: null
            };

            await expect(
                EventRegistrationService.createRegistrationOrder('u1', { eventId: 'e1', fullName: 'J', email: 'j@e.com', phone: '1' })
            ).rejects.toThrow(EventMessages.REGISTRATION_CLOSED);
        });

        test('Registration Flag: Should throw when registration is disabled', async () => {
            mockRegs._data = null;
            mockEvents._data = {
                ...mockEvent,
                is_registration_enabled: false
            };

            await expect(
                EventRegistrationService.createRegistrationOrder('u1', { eventId: 'e1', fullName: 'J', email: 'j@e.com', phone: '1' })
            ).rejects.toThrow(EventMessages.REGISTRATION_CLOSED);
        });

        test('Completed Event: Should throw when event has already ended', async () => {
            mockRegs._data = null;
            mockEvents._data = {
                ...mockEvent,
                status: 'completed',
                end_date: '2026-03-01',
                end_time: '12:00:00'
            };

            await expect(
                EventRegistrationService.createRegistrationOrder('u1', { eventId: 'e1', fullName: 'J', email: 'j@e.com', phone: '1' })
            ).rejects.toThrow(EventMessages.REGISTRATION_CLOSED);
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

        test('User Cancellation (Pending): Should not decrement event registrations', async () => {
            const pendingReg = {
                id: 'r1',
                user_id: 'u1',
                event_id: 'e1',
                status: 'pending',
                payment_status: 'pending',
                amount: 1000,
                email: 'j@e.com',
                full_name: 'J',
                events: { id: 'e1', start_date: '2026-05-01', start_time: '10:00:00', registrations: 4 }
            };

            mockRegs.select.mockImplementationOnce(() => { mockRegs._data = pendingReg; return mockRegs; });
            mockRegs.update.mockImplementationOnce(() => { mockRegs._error = null; return mockRegs; });
            mockRefunds._data = null;

            const result = await EventRegistrationService.cancelRegistration('u1', 'r1');

            expect(result.message).toBe(EventMessages.REGISTRATION_CANCELLED);
            expect(supabase.rpc).not.toHaveBeenCalledWith('decrement_event_registrations', expect.anything());
        });
    });

    describe('Admin Actions', () => {
        test('Create Event: Should auto-set registration deadline 24h before start when missing', async () => {
            const payload = {
                title: 'Auto deadline event',
                scheduleType: 'multi_day_daily',
                startDate: '2026-05-01T00:00:00.000Z',
                startTime: '10:30:00',
                endDate: '2026-05-03T00:00:00.000Z',
                endTime: '12:00:00',
                location: 'Hall A',
                registrationAmount: 0
            };

            mockEvents.insert.mockImplementationOnce((rows) => {
                mockEvents._data = { id: 'e1', ...rows[0] };
                return mockEvents;
            });

            const result = await EventService.createEvent(payload);
            const eventStartTs = getStartTimestamp(payload.startDate, payload.startTime);
            const deadlineTs = new Date(mockEvents._data.registration_deadline).getTime();

            expect(eventStartTs - deadlineTs).toBe(24 * 60 * 60 * 1000);
            expect(mockEvents._data.schedule_type).toBe('multi_day_daily');
            expect(result.scheduleType).toBe('multi_day_daily');
            expect(result.registrationDeadline).toBe(mockEvents._data.registration_deadline);
        });

        test('Update Event: Should recompute registration deadline when admin leaves it unset', async () => {
            mockEvents.select.mockImplementationOnce(() => {
                mockEvents._data = {
                    id: 'e1',
                    title: 'Existing Event',
                    start_date: '2026-05-01T00:00:00.000Z',
                    start_time: '10:00:00',
                    end_date: '2026-05-01T00:00:00.000Z',
                    end_time: '12:00:00',
                    schedule_type: 'single_day',
                    registration_deadline: '2026-04-30T10:00:00.000Z'
                };
                return mockEvents;
            });
            mockEvents.update.mockImplementationOnce((updates) => {
                mockEvents._data = {
                    id: 'e1',
                    title: updates.title,
                    schedule_type: updates.schedule_type,
                    registration_deadline: updates.registration_deadline
                };
                return mockEvents;
            });

            await EventService.updateEvent('e1', {
                title: 'Renamed Event',
                startDate: '2026-05-01T00:00:00.000Z',
                startTime: '10:00:00',
                endDate: '2026-05-01T00:00:00.000Z',
                endTime: '12:00:00',
                registrationDeadline: undefined
            });

            const updatedDeadline = new Date(mockEvents._data.registration_deadline).getTime();
            const updatedStart = getStartTimestamp('2026-05-01T00:00:00.000Z', '10:00:00');
            expect(updatedStart - updatedDeadline).toBe(24 * 60 * 60 * 1000);
            expect(mockEvents._data.schedule_type).toBe('single_day');
        });

        test('Update Event: Should support partial updates without dropping schedule fields', async () => {
            mockEvents.select.mockImplementationOnce(() => {
                mockEvents._data = {
                    id: 'e1',
                    title: 'Existing Event',
                    description: 'Desc',
                    start_date: '2026-05-01T00:00:00.000Z',
                    start_time: '10:00:00',
                    end_date: '2026-05-03T00:00:00.000Z',
                    end_time: '17:00:00',
                    schedule_type: 'multi_day_daily',
                    location: { address: 'Hall A' },
                    registration_deadline: '2026-04-30T10:00:00.000Z'
                };
                return mockEvents;
            });
            mockEvents.update.mockImplementationOnce((updates) => {
                mockEvents._data = { id: 'e1', ...updates };
                return mockEvents;
            });

            const result = await EventService.updateEvent('e1', { title: 'Renamed Event' });

            expect(mockEvents.update).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Renamed Event',
                schedule_type: 'multi_day_daily',
                start_date: '2026-05-01T00:00:00.000Z',
                end_date: '2026-05-03T00:00:00.000Z'
            }));
            expect(result.scheduleType).toBe('multi_day_daily');
        });

        test('Cancel Event', async () => {
            mockEvents.select.mockImplementationOnce(() => {
                mockEvents._data = { id: 'e1', status: 'upcoming', cancellation_status: null };
                return mockEvents;
            });
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

        test('Process Job: Should not rely on stale total_registrations snapshot', async () => {
            mockJobs.update.mockImplementationOnce(() => {
                mockJobs._data = { id: 'j1', event_id: 'e1', status: 'IN_PROGRESS', total_registrations: 0, batch_size: 50 };
                return mockJobs;
            });
            mockEvents.select.mockImplementationOnce(() => {
                mockEvents._data = { id: 'e1', title: 'T', registrations: 1 };
                return mockEvents;
            });
            mockRegs.select
                .mockImplementationOnce(() => {
                    mockRegs._data = [{ id: 'r1', status: 'confirmed', email: 'j@e.com', full_name: 'J' }];
                    return mockRegs;
                })
                .mockImplementationOnce(() => {
                    mockRegs._data = [];
                    return mockRegs;
                });

            await EventCancellationService.processJob('j1');

            expect(emailService.sendEventCancellationEmail).toHaveBeenCalled();
        });

        test('Process Job: Partial failures should keep event in partial failure state', async () => {
            const originalProcessSingleRegistration = EventCancellationService.processSingleRegistration;
            EventCancellationService.processSingleRegistration = jest.fn().mockRejectedValue(new Error('boom'));

            try {
                mockJobs.update.mockImplementationOnce(() => {
                    mockJobs._data = { id: 'j1', event_id: 'e1', status: 'IN_PROGRESS', total_registrations: 1, batch_size: 50, error_log: [] };
                    return mockJobs;
                });
                mockEvents.select.mockImplementationOnce(() => {
                    mockEvents._data = { id: 'e1', title: 'T', registrations: 1 };
                    return mockEvents;
                });
                mockRegs.select
                    .mockImplementationOnce(() => {
                        mockRegs._data = [{ id: 'r1', status: 'confirmed' }];
                        return mockRegs;
                    })
                    .mockImplementationOnce(() => {
                        mockRegs._data = [];
                        return mockRegs;
                    });

                await EventCancellationService.processJob('j1');

                expect(mockEvents.update).toHaveBeenCalledWith(expect.objectContaining({
                    cancellation_status: 'PARTIAL_FAILURE'
                }));
            } finally {
                EventCancellationService.processSingleRegistration = originalProcessSingleRegistration;
            }
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
