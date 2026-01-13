import { ShieldAlertIcon } from "lucide-react";

import {
    Item,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle
} from "@/components/ui/item";

const UnauthenticatedView = () => {
    return (
        <div className="flex items-center justify-center h-screenbg-background">
            <div className="w-full max-w-lg bg-muted">
                <Item variant="outline">
                    <ItemMedia variant="icon">
                        <ShieldAlertIcon />
                    </ItemMedia>
                    <ItemContent>
                        <ItemTitle>
                            Unauthorized Access
                        </ItemTitle>
                        <ItemDescription>
                            Your are not authorized to access this resource.
                        </ItemDescription>
                    </ItemContent>
                </Item>
            </div>
        </div>
    )
}

export default UnauthenticatedView;