import MiniCalendar from '../MiniCalendar'
import StepHeader from '../StepHeader'

interface DateStepProps {
  selectedDate: string | null
  minDate: string
  onSelect: (iso: string) => void
}

export default function DateStep({ selectedDate, minDate, onSelect }: DateStepProps) {
  return (
    <div>
      <StepHeader title="Select a Date" subtitle="Pick when you'd like to play." stepNumber={1} totalSteps={5} />
      <MiniCalendar selected={selectedDate} onSelect={onSelect} minDateISO={minDate} />
    </div>
  )
}
