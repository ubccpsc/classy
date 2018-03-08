# Docker networking and firewall config for AutoTest

## Create bridge network with known subnet

```sh
docker network create \
--driver=bridge \
--subnet=172.28.0.0/16 \
--ip-range=172.28.5.0/24 \
--gateway=172.28.5.254 \
br0
```

## Create test container

```sh
docker build -t net test/container/network
```

## To test

```sh
docker run -it net
```

## Record iptables changes

```sh
# Block all subnet traffic
sudo iptables -I FORWARD -s 172.28.0.0/16 -j DROP

# For a single container:
sudo iptables -N TEST_CHAIN
sudo iptables -I FORWARD -s 172.28.5.0 -j TEST_CHAIN

sudo iptables -I TEST_CHAIN -p udp --dport 53 -m state --state NEW,ESTABLISHED -j ACCEPT
sudo iptables -I TEST_CHAIN -p udp --sport 53 -m state --state ESTABLISHED     -j ACCEPT
sudo iptables -I TEST_CHAIN -p tcp --dport 53 -m state --state NEW,ESTABLISHED -j ACCEPT
sudo iptables -I TEST_CHAIN -p tcp --sport 53 -m state --state ESTABLISHED     -j ACCEPT

sudo iptables -I TEST_CHAIN -d 216.58.216.163 -j ACCEPT # sudo iptables -I TEST_CHAIN -d www.google.ca -j ACCEPT
```
