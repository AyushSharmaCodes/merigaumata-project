import { UserOrderDetailView } from "./UserOrderDetailView";
import { useUserOrderDetailPage } from "../hooks/useUserOrderDetailPage";

export function UserOrderDetailFeature() {

    const controller = useUserOrderDetailPage();

    return (
        <UserOrderDetailView
            orderId={controller.orderId}
            order={controller.order}
            returns={controller.returns}
            returnableItems={controller.returnableItems}
            isLoading={controller.isLoading}
            isActionLoading={controller.isActionLoading}
            isOpeningReturnDialog={controller.isOpeningReturnDialog}
            loadingMessage={controller.loadingMessage}
            cancelOpen={controller.cancelOpen}
            returnOpen={controller.returnOpen}
            returnSuccessData={controller.returnSuccessData}
            canCancel={controller.canCancel}
            canReturn={controller.canReturn}
            latestReturnReason={
                controller.latestReturn?.status === "rejected"
                    ? controller.latestReturn.staff_notes || controller.latestReturn.reason || "Policy non-compliance"
                    : undefined
            }
            onCancelDialogChange={controller.setCancelOpen}
            onReturnDialogChange={controller.setReturnOpen}
            onConfirmCancelOrder={controller.handleCancelOrder}
            onOpenReturnDialog={controller.handleOpenReturnDialog}
            onSubmitReturn={async (selectedItems, reasonCategory, specificReason, additionalDetails, images) => {
                await controller.handleSubmitReturn({
                    selectedItems,
                    reasonCategory,
                    specificReason,
                    additionalDetails,
                    images,
                });
            }}
            onDismissReturnSuccess={() => controller.setReturnSuccessData(null)}
            onContactSupport={controller.navigateToContact}
        />
    );
}
