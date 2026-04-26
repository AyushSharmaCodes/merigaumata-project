import { UserReturnDetailView } from "./UserReturnDetailView";
import { useUserReturnDetailPage } from "../hooks/useUserReturnDetailPage";

export function UserReturnDetailFeature() {
    const controller = useUserReturnDetailPage();

    return (
        <UserReturnDetailView
            orderId={controller.orderId}
            returnId={controller.returnId}
            order={controller.order}
            returnRequest={controller.returnRequest}
            returns={controller.returns}
            error={controller.error}
            isLoadingOrder={controller.isLoadingOrder}
            isLoadingReturn={controller.isLoadingReturn}
            onBackToOrder={controller.navigateBackToOrder}
        />
    );
}
