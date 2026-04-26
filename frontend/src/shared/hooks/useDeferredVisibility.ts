import { useEffect, useRef, useState } from "react";

export function useDeferredVisibility(rootMargin = "240px 0px") {
    const targetRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isVisible) {
            return;
        }

        const target = targetRef.current;
        if (!target || typeof IntersectionObserver === "undefined") {
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0]?.isIntersecting) {
                    return;
                }

                setIsVisible(true);
                observer.disconnect();
            },
            { rootMargin }
        );

        observer.observe(target);

        return () => observer.disconnect();
    }, [isVisible, rootMargin]);

    return {
        isVisible,
        targetRef,
    };
}
