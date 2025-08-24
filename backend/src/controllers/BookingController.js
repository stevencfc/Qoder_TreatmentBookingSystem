const { catchAsync, AppError, NotFoundError, AuthorizationError, ConflictError } = require('../middleware/errorHandler');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const config = require('../config');

class BookingController {
  /**
   * Get all bookings with filtering
   */
  static getAllBookings = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'bookingDateTime', sortOrder = 'desc', storeId, status, customerId, date } = req.query;
    const { Booking, User, Store, Treatment } = sequelize.models;
    
    const where = {};
    
    // Role-based filtering
    if (req.user.role === config.roles.CUSTOMER) {
      where.customerId = req.user.id;
    } else if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      where.storeId = req.user.storeId;
    } else if (storeId) {
      where.storeId = storeId;
    }
    
    if (status) where.status = status;
    if (customerId && req.user.role !== config.roles.CUSTOMER) where.customerId = customerId;
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.bookingDateTime = { [sequelize.Sequelize.Op.between]: [startOfDay, endOfDay] };
    }

    const offset = (page - 1) * limit;
    
    const { count, rows: bookings } = await Booking.findAndCountAll({
      where,
      include: [
        { model: User, as: 'customer', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
        { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName'], required: false },
        { model: Store, as: 'store', attributes: ['id', 'name', 'timezone'] },
        { model: Treatment, as: 'treatment', attributes: ['id', 'name', 'duration', 'price'] }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]]
    });

    const bookingsWithMeta = bookings.map(booking => {
      const bookingData = booking.toJSON();
      bookingData.endDateTime = booking.getEndDateTime();
      bookingData.canBeCancelled = booking.canBeCancelled();
      bookingData.canBeModified = booking.canBeModified();
      bookingData.formattedPrice = booking.getFormattedPrice();
      return bookingData;
    });

    res.json({
      success: true,
      data: bookingsWithMeta,
      meta: {
        page: parseInt(page),
        pageSize: parseInt(limit),
        totalCount: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  });

  /**
   * Get booking by ID
   */
  static getBookingById = catchAsync(async (req, res) => {
    const { bookingId } = req.params;
    const { Booking, User, Store, Treatment } = sequelize.models;

    const booking = await Booking.findByPk(bookingId, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
        { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName'], required: false },
        { model: Store, as: 'store', attributes: ['id', 'name', 'timezone', 'address'] },
        { model: Treatment, as: 'treatment', attributes: ['id', 'name', 'description', 'duration', 'price'] }
      ]
    });

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Authorization check
    if (req.user.role === config.roles.CUSTOMER && booking.customerId !== req.user.id) {
      throw new AuthorizationError('You can only access your own bookings');
    } else if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (booking.storeId !== req.user.storeId) {
        throw new AuthorizationError('You can only access bookings from your store');
      }
    }

    const bookingData = booking.toJSON();
    bookingData.endDateTime = booking.getEndDateTime();
    bookingData.canBeCancelled = booking.canBeCancelled();
    bookingData.canBeModified = booking.canBeModified();
    bookingData.formattedPrice = booking.getFormattedPrice();

    res.json({ success: true, data: bookingData });
  });

  /**
   * Create new booking
   */
  static createBooking = catchAsync(async (req, res) => {
    const { customerId, storeId, treatmentId, staffId, bookingDateTime, notes } = req.body;
    const { Booking, Treatment, Store, User } = sequelize.models;

    // Set customer ID based on role
    const finalCustomerId = req.user.role === config.roles.CUSTOMER ? req.user.id : customerId;
    
    if (!finalCustomerId) {
      throw new AppError('Customer ID is required', 400, 'CUSTOMER_REQUIRED');
    }

    // Validate treatment and store
    const treatment = await Treatment.findByPk(treatmentId, { include: [{ model: Store, as: 'store' }] });
    if (!treatment || !treatment.isActive) {
      throw new NotFoundError('Treatment');
    }

    if (treatment.storeId !== storeId) {
      throw new AppError('Treatment does not belong to the specified store', 400, 'TREATMENT_STORE_MISMATCH');
    }

    // Validate customer exists
    const customer = await User.findByPk(finalCustomerId);
    if (!customer || !customer.isActive) {
      throw new NotFoundError('Customer');
    }

    // Validate staff if provided
    if (staffId) {
      const staff = await User.findByPk(staffId);
      if (!staff || staff.storeId !== storeId || !['staff', 'store_admin'].includes(staff.role)) {
        throw new AppError('Invalid staff assignment', 400, 'INVALID_STAFF');
      }
    }

    // Check for booking conflicts
    const bookingStart = new Date(bookingDateTime);
    const bookingEnd = new Date(bookingStart.getTime() + treatment.duration * 60000);

    if (staffId) {
      const conflictingBookings = await Booking.findConflicting(staffId, bookingStart, bookingEnd);
      if (conflictingBookings.length > 0) {
        throw new ConflictError('Staff member is not available at the requested time');
      }
    }

    // Create booking
    const booking = await Booking.create({
      customerId: finalCustomerId,
      storeId,
      treatmentId,
      staffId,
      bookingDateTime: bookingStart,
      duration: treatment.duration,
      status: config.bookingStatus.PENDING,
      price: treatment.price,
      notes
    });

    // Load booking with relations
    const bookingWithRelations = await Booking.findByPk(booking.id, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName'], required: false },
        { model: Store, as: 'store', attributes: ['id', 'name'] },
        { model: Treatment, as: 'treatment', attributes: ['id', 'name', 'duration', 'price'] }
      ]
    });

    logger.logBookingEvent('booking_created', booking.id, req.user.id, { 
      customerId: finalCustomerId, 
      storeId, 
      treatmentId,
      bookingDateTime: bookingStart.toISOString()
    });

    res.status(201).json({ success: true, data: bookingWithRelations.toJSON() });
  });

  /**
   * Update booking
   */
  static updateBooking = catchAsync(async (req, res) => {
    const { bookingId } = req.params;
    const updates = req.body;
    const { Booking, User } = sequelize.models;

    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Authorization check
    if (req.user.role === config.roles.CUSTOMER) {
      if (booking.customerId !== req.user.id) {
        throw new AuthorizationError('You can only update your own bookings');
      }
      // Customers can only update notes and cancel
      const allowedUpdates = ['notes'];
      if (updates.status === config.bookingStatus.CANCELLED) {
        allowedUpdates.push('status', 'cancellationReason');
      }
      
      Object.keys(updates).forEach(key => {
        if (!allowedUpdates.includes(key)) {
          delete updates[key];
        }
      });
    } else if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (booking.storeId !== req.user.storeId) {
        throw new AuthorizationError('You can only update bookings from your store');
      }
    }

    // Validate staff assignment if being updated
    if (updates.staffId && updates.staffId !== booking.staffId) {
      const staff = await User.findByPk(updates.staffId);
      if (!staff || staff.storeId !== booking.storeId || !['staff', 'store_admin'].includes(staff.role)) {
        throw new AppError('Invalid staff assignment', 400, 'INVALID_STAFF');
      }

      // Check for conflicts with new staff
      const bookingStart = new Date(updates.bookingDateTime || booking.bookingDateTime);
      const bookingEnd = new Date(bookingStart.getTime() + booking.duration * 60000);
      
      const conflictingBookings = await Booking.findConflicting(updates.staffId, bookingStart, bookingEnd, bookingId);
      if (conflictingBookings.length > 0) {
        throw new ConflictError('Staff member is not available at the requested time');
      }
    }

    // Validate booking can be modified
    if (!booking.canBeModified() && !['status', 'notes', 'cancellationReason'].some(field => updates.hasOwnProperty(field))) {
      throw new AppError('Booking cannot be modified at this time', 400, 'BOOKING_NOT_MODIFIABLE');
    }

    await booking.update(updates);

    logger.logBookingEvent('booking_updated', bookingId, req.user.id, { updates });

    res.json({ success: true, data: booking.toJSON() });
  });

  /**
   * Cancel booking
   */
  static cancelBooking = catchAsync(async (req, res) => {
    const { bookingId } = req.params;
    const { cancellationReason } = req.body;

    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Authorization check
    if (req.user.role === config.roles.CUSTOMER && booking.customerId !== req.user.id) {
      throw new AuthorizationError('You can only cancel your own bookings');
    } else if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (booking.storeId !== req.user.storeId) {
        throw new AuthorizationError('You can only cancel bookings from your store');
      }
    }

    if (!booking.canBeCancelled()) {
      throw new AppError('Booking cannot be cancelled at this time', 400, 'BOOKING_NOT_CANCELLABLE');
    }

    await booking.update({
      status: config.bookingStatus.CANCELLED,
      cancellationReason: cancellationReason || 'Cancelled by user',
      cancelledAt: new Date()
    });

    logger.logBookingEvent('booking_cancelled', bookingId, req.user.id, { cancellationReason });

    res.json({ 
      success: true, 
      data: { 
        message: 'Booking cancelled successfully',
        booking: booking.toJSON()
      }
    });
  });

  /**
   * Update booking status
   */
  static updateBookingStatus = catchAsync(async (req, res) => {
    const { bookingId } = req.params;
    const { status } = req.body;

    // Only staff and admins can update booking status
    if ([config.roles.CUSTOMER].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to update booking status');
    }

    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    if (booking.storeId !== req.user.storeId) {
      throw new AuthorizationError('You can only update bookings from your store');
    }

    const oldStatus = booking.status;
    await booking.update({ status });

    logger.logBookingEvent('booking_status_updated', bookingId, req.user.id, { 
      oldStatus, 
      newStatus: status 
    });

    res.json({ 
      success: true, 
      data: { 
        message: `Booking status updated to ${status}`,
        booking: booking.toJSON()
      }
    });
  });
}

module.exports = BookingController;