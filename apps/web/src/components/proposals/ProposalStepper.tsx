import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

interface ProposalStepperProps {
  proposalId: string;
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { number: 1, label: 'Constructor de Propuesta', path: 'builder' },
  { number: 2, label: 'Ventana de Cálculos', path: 'calculations' },
  { number: 3, label: 'Construcción del Documento', path: 'document' },
] as const;

type StepStatus = 'completed' | 'active' | 'pending';

function getStepStatus(stepNumber: number, currentStep: number): StepStatus {
  if (stepNumber < currentStep) return 'completed';
  if (stepNumber === currentStep) return 'active';
  return 'pending';
}

function getLineColor(leftStatus: StepStatus, rightStatus: StepStatus): string {
  if (leftStatus === 'completed' && rightStatus === 'completed') return 'bg-emerald-400';
  if (leftStatus === 'completed' && rightStatus === 'active') return 'bg-indigo-400';
  return 'bg-slate-200';
}

const CIRCLE_STYLES: Record<StepStatus, string> = {
  completed:
    'bg-emerald-500 text-white shadow-md shadow-emerald-200',
  active:
    'bg-indigo-600 text-white shadow-md shadow-indigo-200 ring-4 ring-indigo-100',
  pending:
    'bg-slate-200 text-slate-400',
};

const LABEL_STYLES: Record<StepStatus, string> = {
  completed: 'text-slate-600 font-bold',
  active: 'text-indigo-600 font-black',
  pending: 'text-slate-400 font-medium',
};

export default function ProposalStepper({ proposalId, currentStep }: ProposalStepperProps) {
  const navigate = useNavigate();

  const handleStepClick = (step: typeof STEPS[number], status: StepStatus) => {
    if (status === 'pending') return;
    navigate(`/proposals/${proposalId}/${step.path}`);
  };

  return (
    <nav className="w-full py-4" aria-label="Progreso de la propuesta">
      <ol className="flex items-center justify-center">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.number, currentStep);
          const isClickable = status !== 'pending';

          return (
            <li key={step.number} className="flex items-center">
              {/* Connector line BEFORE this step (skip for first) */}
              {index > 0 && (
                <div
                  className={`h-1 w-12 sm:w-20 md:w-28 rounded-full transition-colors duration-300 ${getLineColor(
                    getStepStatus(STEPS[index - 1].number, currentStep),
                    status,
                  )}`}
                />
              )}

              {/* Step circle + label */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleStepClick(step, status)}
                  disabled={!isClickable}
                  aria-current={status === 'active' ? 'step' : undefined}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold
                    transition-all duration-200
                    ${CIRCLE_STYLES[status]}
                    ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                  `}
                >
                  {status === 'completed' ? <Check className="h-5 w-5" /> : step.number}
                </button>

                <span
                  className={`mt-2 hidden text-xs text-center max-w-[7rem] leading-tight sm:block ${LABEL_STYLES[status]}`}
                >
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
