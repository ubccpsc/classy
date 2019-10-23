# Operations

<!-- TOC depthfrom:2 -->

- [1. Architecture](/docs/tech-staff/architecture.md#overview)
    - [1.1 Network Layer](#network-layer)
    - [1.2 Application Layer](#application-layer)
- [1.2 Hardware Requirements](/docs/tech-staff/hardware.md)
- [1.3 Fork Customization](/docs/tech-staff/forkcustomization.md)
- [1.4 Installation](/docs/tech-staff/install.md)
    - [1.4.1 Software Dependencies](/docs/tech-staff/install.md#software-dependencies)
    - [1.4.2 Install Classy](/docs/tech-staff/install.md#install-classy)
    - [1.4.3 System Configuration](/docs/tech-staff/install.md#create-user-group)
    - [1.4.4 Create SSL Certificates](/docs/tech-staff/install.md#create-ssl-certificates)
    - [1.4.5 Configure Firewall Rules](/docs/tech-staff/install.md#create-firewall-rules)
- [1.5 Github Setup](/docs/tech-staff/githubsetup.md)
- [1.6 Backup Configuration](/docs/tech-staff/backups.md)
- [1.7 Build/Start/Stop Classy](/docs/tech-staff/operatingclassy.md)
- [1.8 Patching](/docs/tech-staff/updates.md)
    - [1.8.1 Operating System](/docs/tech-staff/updates.md#operating-system)
    - [1.8.2 Classy](/docs/tech-staff/updates.md#classy)

<!-- /TOC -->

## Overview

Classy consists of multiple supporting applications: AutoTest, Portal Front-End, and Portal Back-End. Classy uses MongoDB for its data layer. The applications are containerized, which means that they run in Docker containers in a virtual environment where they can communicate. The virtual that currently hosts Classy is a VM server.

Classy requires technical operational support to offer Classy in a course due to its integrated systems, SSL certificates, ongoing development, hardware requirements, security updates, and other technical concerns.

In addition to operating Classy, bootstrapping integrated systems and customizing configurations also require documentation due to ensure that the system is configured correctly before Classy begins to operate for a course.

## Network Layer

The network layer requires access to the internet to install, build, and run Classy. Docker Compose is a Docker orchestration tool that simplifies the  installation and running of Classy.

If Docker is properly installed and the environment that is hosting Classy has access to the internet, minimal effort is needed to setup the network layer.

<img src="../assets/classy-network-layer.svg">

## Application Layer

The appication layer is containerized for staging and production Classy instances. The Portal and AutoTest applications are Node JS based applications that are hosted with Nginx routing and a NoSQL MongoDB database.

<img src="../assets/vm-container-applications.svg">
