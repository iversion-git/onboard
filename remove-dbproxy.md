# To temporarily remove RDS Proxy:

1. Comment out or delete these sections in both templates:
   - DBProxyRole (lines ~1395-1425)
   - DBProxy (lines ~1426-1450)
   - DBProxyTargetGroup (lines ~1451-1460)

2. Remove DBProxy outputs:
   - DBProxyEndpoint output (lines in Outputs section)

3. Deploy without RDS Proxy
4. Add RDS Proxy back later once basic infrastructure is working

This allows you to get the Aurora MySQL cluster running first, then troubleshoot RDS Proxy separately.