import React from "react";
import { X, Camera, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StepUploadProofProps {
    images: File[];
    onAddImages: (files: File[]) => void;
    onRemoveImage: (index: number) => void;
}

export function StepUploadProof({ images, onAddImages, onRemoveImage }: StepUploadProofProps) {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            onAddImages(Array.from(e.target.files));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-2">
                <h3 className="text-sm font-bold text-slate-800">Provide Photographic Proof</h3>
                <p className="text-xs text-slate-500">Upload up to 3 clear photos of the item and its packaging.<br/>This helps us expedite your return request.</p>
            </div>

            <div className="flex gap-4 justify-center">
                {[0, 1, 2].map((index) => {
                    const file = images[index];

                    if (file) {
                        return (
                            <div key={index} className="relative w-28 h-28 rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
                                <img src={URL.createObjectURL(file)} alt={`Proof ${index + 1}`} className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => onRemoveImage(index)}
                                    className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                                <div className="absolute top-1 left-1 text-[10px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded">
                                    {index + 1}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <label
                            key={index}
                            className={`w-28 h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all
                                ${index === images.length ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}
                            `}
                        >
                            <Camera className={`w-6 h-6 mb-2 ${index === images.length ? "text-emerald-500" : "text-slate-400"}`} />
                            <span className={`text-[10px] font-bold ${index === images.length ? "text-emerald-700" : "text-slate-400"}`}>
                                {index === images.length ? "Add Photo" : "Optional"}
                            </span>
                            <div className="absolute top-2 right-2 text-[10px] font-bold text-slate-300">
                                {index + 1}
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleFileChange}
                                disabled={index > images.length} // Only enable the immediate next slot
                            />
                        </label>
                    );
                })}
            </div>

            <Alert className="bg-orange-50 border-none rounded-xl mt-6">
                <Info className="h-4 w-4 text-emerald-700" />
                <AlertDescription className="text-xs text-slate-600 ml-2">
                    Please ensure photos are well-lit and clearly show any damage or defects mentioned in the previous step. Accepted formats: JPG, PNG (Max 5MB per file).
                </AlertDescription>
            </Alert>
        </div>
    );
}
