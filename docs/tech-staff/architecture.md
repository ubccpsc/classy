# Architecture

<!-- TOC depthfrom:2 -->

- [Architecture](#architecture)
  - [Overview](#overview)
  - [Network Layer](#network-layer)
  - [Application Layer](#application-layer)

<!-- /TOC -->

## Overview

Classy consists of multiple supporting applications: AutoTest, Portal Front-End, and Portal Back-End. Classy uses MongoDB as its data layer. The applications are containerized, which means that they run in Docker containers on a host where they can communicate. Classy is currently hosted on virtual machines (VMs).

Classy requires technical operational support to offer Classy in a course due to its integrated systems, SSL certificates, ongoing development, hardware requirements, security updates, and other technical concerns.

In addition to operating Classy, bootstrapping integrated systems and customizing configurations requires documentation that ensures Classy is configured correctly before Classy is ready to be used in a course.

## Network Layer

The network layer requires access to the internet to install, build, and run Classy. Docker Compose is a Docker orchestration tool that simplifies the installation and operation of Classy.

If Docker is properly installed and the environment that is hosting Classy has access to the internet, minimal effort is needed to setup the network layer.

<img src="../assets/classy-network-layer.svg">

## Application Layer

In staging and production environments, the appication layer is broken into supporting applications that are Dockerized. The Portal and AutoTest applications are Node JS based applications that are hosted with Nginx routing and a NoSQL MongoDB database.

<img src="../assets/vm-container-applications.svg">
