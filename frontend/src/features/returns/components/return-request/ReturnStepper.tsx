import React from "react";
import { Check } from "lucide-react";

interface ReturnStepperProps {
    currentStep: number;
}

export function ReturnStepper({ currentStep }: ReturnStepperProps) {
    const steps = [
        { num: 1, label: "Select Items" },
        { num: 2, label: "Return Details" },
        { num: 3, label: "Upload Proof" },
    ];

    return (
        <div className="flex items-center justify-center w-full my-6">
            {steps.map((step, index) => {
                const isActive = currentStep === step.num;
                const isCompleted = currentStep > step.num;

                return (
                    <React.Fragment key={step.num}>
                        <div className="flex flex-col items-center gap-2 w-24">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                                ${isActive ? "bg-emerald-700 text-white" : 
                                  isCompleted ? "bg-emerald-700 text-white" : 
                                  "bg-slate-100 text-slate-500"}`}
                            >
                                {isCompleted ? <Check className="w-4 h-4" /> : step.num}
                            </div>
                            <span
                                className={`text-[11px] font-bold text-center ${
                                    isActive || isCompleted ? "text-emerald-700" : "text-slate-400"
                                }`}
                            >
                                {step.label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`h-[2px] w-12 mx-2 mb-6 ${isCompleted ? "bg-emerald-700" : "bg-slate-100"}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
