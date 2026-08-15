import { useBookingFlow } from '../../hooks/useBookingFlow'
import Card from '../ui/Card'
import DateStep from './steps/DateStep'
import TimeStep from './steps/TimeStep'
import DurationStep from './steps/DurationStep'
import CustomerInfoStep from './steps/CustomerInfoStep'
import SummaryStep from './steps/SummaryStep'
import ConfirmationStep from './steps/ConfirmationStep'

export default function BookingWidget() {
  const flow = useBookingFlow()

  return (
    <Card className="p-5 sm:p-7">
      {flow.step === 'date' && (
        <DateStep selectedDate={flow.date} minDate={flow.minDate} onSelect={flow.selectDate} />
      )}

      {flow.step === 'time' && flow.date && (
        <TimeStep
          date={flow.date}
          availableStartHours={flow.availableStartHours}
          loading={flow.loadingAvailability}
          onSelect={flow.selectStartHour}
          onBack={flow.goBack}
        />
      )}

      {flow.step === 'duration' && flow.date && flow.startHour !== null && (
        <DurationStep
          date={flow.date}
          startHour={flow.startHour}
          availableDurations={flow.availableDurations}
          onSelect={flow.selectDuration}
          onBack={flow.goBack}
        />
      )}

      {flow.step === 'info' && (
        <CustomerInfoStep
          value={flow.customer}
          onChange={flow.setCustomer}
          onSubmit={flow.submitCustomerInfo}
          onBack={flow.goBack}
        />
      )}

      {flow.step === 'summary' &&
        flow.date &&
        flow.startHour !== null &&
        flow.duration &&
        flow.endTime &&
        flow.priceResult?.valid && (
          <SummaryStep
            date={flow.date}
            startHour={flow.startHour}
            endTime={flow.endTime}
            duration={flow.duration}
            price={flow.priceResult}
            customer={flow.customer}
            submitting={flow.submitting}
            submitError={flow.submitError}
            onConfirm={flow.submitBooking}
            onBack={flow.goBack}
            promoInput={flow.promoInput}
            setPromoInput={flow.setPromoInput}
            appliedPromo={flow.appliedPromo}
            promoChecking={flow.promoChecking}
            promoError={flow.promoError}
            onApplyPromo={flow.applyPromoCode}
            onRemovePromo={flow.removePromoCode}
          />
        )}

      {flow.step === 'confirmation' && flow.confirmedBooking && (
        <ConfirmationStep booking={flow.confirmedBooking} onBookAnother={flow.reset} />
      )}
    </Card>
  )
}
