"""An Azure RM Python Pulumi program"""

import pulumi
from pulumi_azure_native import storage
from pulumi_azure_native import resources

# Create an Azure Resource Group
resource_group = resources.ResourceGroup("resource_group")

# Create an Azure Storage Account
account = storage.StorageAccount(
    "sa",
    resource_group_name=resource_group.name,
    sku={
        "name": storage.SkuName.STANDARD_LRS,
    },
    kind=storage.Kind.STORAGE_V2,
)

static_website = storage.StorageAccountStaticWebsite("iac_website", 
    resource_group_name=resource_group.name,
    account_name=account.name,
    index_document="index.html"
)

index_html = storage.Blob("index.html", 
    resource_group_name=resource_group.name,
    account_name=account.name,
    container_name=static_website.container_name,
    source=pulumi.asset.FileAsset("./website/index.html"),
    content_type="text/html"
)


# Export the storage account name
pulumi.export("storage_account_name", account.name)

# Export the static website URL (web endpoint on the storage account)
pulumi.export("website_url", account.primary_endpoints.web)
