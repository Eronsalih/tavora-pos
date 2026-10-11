$Api = "http://localhost:8000"
$Stamp = Get-Date -Format "yyyyMMddHHmmss"
$Pass = 0
$Fail = 0

function Call($Method, $Path, $Token = $null, $Body = $null) {
    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $params = @{ Method = $Method; Uri = "$Api$Path"; Headers = $headers; ContentType = "application/json" }
    if ($null -ne $Body) { $params["Body"] = ($Body | ConvertTo-Json -Depth 5) }
    try {
        $data = Invoke-RestMethod @params
        return @{ Status = 200; Data = $data }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        return @{ Status = $code; Data = $null; Error = $_.ErrorDetails.Message }
    }
}

function Check($Name, $Condition) {
    if ($Condition) { Write-Host "  [OK]   $Name" -ForegroundColor Green; $script:Pass++ }
    else { Write-Host "  [FAIL] $Name" -ForegroundColor Red; $script:Fail++ }
}

function New-Cafe($Letter) {
    $email = "cafe$Letter.$Stamp@example.com"
    $pin = if ($Letter -eq "A") { "1111" } else { "2222" }
    $signup = Call POST "/api/auth/signup" $null @{ business_name = "Test Cafe $Letter $Stamp"; name = "Owner $Letter"; email = $email; password = "Test12345!"; pin = $pin }
    if ($signup.Status -ne 200) { throw "Signup $Letter failed: $($signup.Error)" }
    $login = Call POST "/api/auth/login" $null @{ email = $email; password = "Test12345!" }
    if ($login.Status -ne 200) { throw "Login $Letter failed: $($login.Error)" }
    $token = $login.Data.access_token
    $payment = Call POST "/api/payments" $token @{ plan = "pro"; provider = "manual" }
    $activated = Call POST "/api/payments/$($payment.Data.id)/simulate-success" $token
    if ($activated.Status -ne 200) { throw "Could not activate cafe $Letter. Is ALLOW_DEMO_TOOLS=true in .env and the backend rebuilt?" }
    $tableList = @((Call GET "/api/tables" $token).Data)
    $productList = @((Call GET "/api/products" $token).Data)
    $order = Call POST "/api/orders" $token @{ table_id = $tableList[0].id; items = @(@{ product_id = $productList[0].id; quantity = 1 }) }
    return @{ Email = $email; Token = $token; BusinessId = $login.Data.user.business_id; Tables = $tableList; Products = $productList; Order = $order.Data }
}

Write-Host "`n=== Creating 2 test cafes ===" -ForegroundColor Cyan
$A = New-Cafe "A"
$B = New-Cafe "B"
Write-Host "  Cafe A: $($A.Email)"
Write-Host "  Cafe B: $($B.Email)"

Write-Host "`n=== 1. Each cafe sees only its own data ===" -ForegroundColor Cyan
Check "A and B are different businesses" ($A.BusinessId -ne $B.BusinessId)
$bTableIds = $B.Tables | ForEach-Object { $_.id }
Check "A's tables contain none of B's" (-not ($A.Tables | Where-Object { $bTableIds -contains $_.id }))
$bProductIds = $B.Products | ForEach-Object { $_.id }
Check "A's products contain none of B's" (-not ($A.Products | Where-Object { $bProductIds -contains $_.id }))
$aOrders = @((Call GET "/api/orders" $A.Token).Data)
Check "A's orders do not contain B's order" (-not ($aOrders | Where-Object { $_.id -eq $B.Order.id }))

Write-Host "`n=== 2. A tries to READ B's data ===" -ForegroundColor Cyan
Check "A cannot open B's order (404)" ((Call GET "/api/orders/$($B.Order.id)" $A.Token).Status -eq 404)
Check "A cannot open B's table (404)" ((Call GET "/api/tables/$($B.Tables[0].id)" $A.Token).Status -eq 404)
Check "A cannot open B's product (404)" ((Call GET "/api/products/$($B.Products[0].id)" $A.Token).Status -eq 404)

Write-Host "`n=== 3. A tries to CHANGE B's data ===" -ForegroundColor Cyan
Check "A cannot pay B's order" ((Call PATCH "/api/orders/$($B.Order.id)/pay" $A.Token @{ payment_method = "cash" }).Status -eq 404)
Check "A cannot cancel B's order" ((Call PATCH "/api/orders/$($B.Order.id)/cancel" $A.Token).Status -eq 404)
Check "A cannot delete B's product" ((Call DELETE "/api/products/$($B.Products[0].id)" $A.Token).Status -eq 404)
Check "A cannot delete B's table" ((Call DELETE "/api/tables/$($B.Tables[1].id)" $A.Token).Status -eq 404)
Check "A cannot order on B's table" ((Call POST "/api/orders" $A.Token @{ table_id = $B.Tables[1].id; items = @(@{ product_id = $A.Products[0].id; quantity = 1 }) }).Status -eq 404)
Check "A cannot use B's product" ((Call POST "/api/orders" $A.Token @{ table_id = $A.Tables[1].id; items = @(@{ product_id = $B.Products[0].id; quantity = 1 }) }).Status -eq 404)

Write-Host "`n=== 4. Staff and admin areas ===" -ForegroundColor Cyan
$aUsers = @((Call GET "/api/auth/users" $A.Token).Data)
Check "A's staff list has only A's users" (-not ($aUsers | Where-Object { $_.business_id -ne $A.BusinessId }))
Check "Cafe admin cannot open platform admin (403)" ((Call GET "/api/platform-admin/businesses" $A.Token).Status -eq 403)
Check "A's PIN does not work for B" ((Call POST "/api/auth/pin-login" $null @{ business_id = $B.BusinessId; pin = "1111" }).Status -eq 401)

Write-Host "`n=== 5. B's data is still intact ===" -ForegroundColor Cyan
$bOrder = Call GET "/api/orders/$($B.Order.id)" $B.Token
Check "B's order still exists and is open" ($bOrder.Status -eq 200 -and $bOrder.Data.status -eq "draft")
Check "B's product still exists" ((Call GET "/api/products/$($B.Products[0].id)" $B.Token).Status -eq 200)

$color = if ($Fail -eq 0) { "Green" } else { "Red" }
Write-Host "`n=== Result: $Pass passed, $Fail failed ===`n" -ForegroundColor $color
