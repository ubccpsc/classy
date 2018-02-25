echo "Version 1"
echo "sleeping 2"
sleep 2
echo "open pipe"
echo "NET ALLOW http://www.google.ca" | nc -vv 192.168.0.19 7777
wget www.google.ca
wget www.bing.ca
