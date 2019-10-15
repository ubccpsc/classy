# Course Instructions

## Overview

AutoTest configurations allow for the unique delivery of course content based on course requirements. The configuration steps below give you basic introduction to steps for a typical course delivery.

## Classlist Enrollment

Classy does not automatically know what students are enrolled in your course. An API endpoint with student information has been integrated with Classy that allows it to access the *current* enrollment information for a course. An instructor must update the classlist enrollment before the application can interact with any student information.

The default Admin view contains a **Update Classlist** action that adds students, updates student information, removes deregistered students. This button action, therefore, should be treated as an upsert. A list of the modifications for each add, update, and remove event can be viewed after the update and saved if necessary.

If more customizable classlist updates are necessary, a CSV may be uploaded with a custom classlist by the instructor.

<img src="./assets/admin-config-classlist.png" alt="Classlist API update and customizable classlist upload feature">

## Deliverable Configurations

A deliverable has many possible configurations that result in unique AutoTest and Classy behvaiour. Creating a deliverable is necessary for the following actions: provisioning reopsitories with or without starter code, AutoTest feedback functionality, storing grade information in Classy. The creation for a deliverable preceeds all student functionality in AutoTest and Classy.


## Distributing Assignments and Repository Creation

