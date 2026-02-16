# Forever (לעולם) Memorial PRD

## Overview
The לעולם / Forever memorial website is a place for users to post memorial pages for their loved ones who have passed away. In many cases friends and family have stories they can share about the deceased and those stories are not memorialized in any organized way. They are perhaps shared in passing or in condolence calls. The לעולם / Forever website will provide a platform for the sharing of stories, images, or thoughts with the community and the mourners. Memorial pages are public by default and designed to be shared with family, friends, and the wider community.

## Users & Roles
The website supports three types of users:
* _Guests_ can:
 * search for memorial pages
 * view memorial pages
* _Registered Users_ can:
 * create new memorial pages (users can own many pages) 
 * edit pages they own, 
 * submit memories on memorial pages owned by another user for review by the page owner
* _Site Admin_ can:
 * administer the site 
 * edit memorial pages owned by any user

### Authentication
Users can register and login with Google or with a magic link via email. (Passwords not supported in v1)

### Profile Management
* A user can edit their profile information or delete their account from their dashboard. When an account is deleted the memorial pages it owns are also deleted (with the appropriate warning message)

## Landing Page
The Landing Page page is where guests arrive when visiting the site. It describes the site's purpose and functionality and offers users to register for a new account (or log in). 

### Search
The search feature is available on the landing page and persistent across memorial pages. Searching can be done by the name of the deceased, and supports suggestions by partial search. Names in the suggestions are returned as "Name (place of death)".
If a user presses search or enter, a search results page is shown with the name of the deceased, the memorial picture, the place and date of death.

### Recent memorials
The Landing Page also shows the most recent memorials added to the site in the same fashion as the search results.

## Dashboard
The Dashboard is the homepage for registered users. It supports the following functionality:
* Edit user's profile (name, avatar)
* List of user's memorial pages, with an option to delete the page
* Create a new memorial page
* Review memories submitted by other users

### Review memory flow
Memories submitted by other users can be reviewed by the owner of the memorial page. The following options are available:
* Edit
* Accept
* Ignore (removed from list but not deleted). An option to view ignored memories should be available in the review memory list.
* Return to submitter 
 * User received an email with the message from the page owner, and an link to edit the memory
 * User edits and resubmits from the provided link
 * Review cycle starts again (appears in list for page owner to review)

Users receive an email message when their submitted memories are accepted or are returned.

## Memorial Page
The memorial page provides the main functionality on the site. It has two modes- _view_ and _edit_ (for the page owner only). The following sections are available:

### General information
* Name (required)
* Memorial picture
* Birthday
* Date of death (required)
* Place of death
* Funeral information (free text)
* Survived by (free text)

### Life story
Text area to describe life story 

### Image gallery
Images organized in albums, with a default album automatically created. Apply sensible restrictions on image size (5MB?) and number of images (100?)

### Eulogies
Multiple eulogies, each with the text, whom it was delivered by and their relation to the deceased

### Memories
Multiple memories, submitted and approved by a page owner. Memories include:
* Name of user who submitted the memory (with an option to ask the name to be withheld when displayed)
* How they knew the deceased
* Text 
* Pictures

Memories are listed in the order they are submitted. Memories can be edited by the owner of the memorial page at any time when the page is in edit mode, but not by the memory submitter unless returned by the memorial page owner.

## Privacy & Moderation
* All pages are public and searchable in V1. 
* Admins can remove any memory, disable any memory page, and ban/disable any user accounts

## Notifications
Users receive notifications:
* When a memory is accepted or returned
* When a new memory is added a memorial page they own

## Non-functional requirements
* Support mobile or desktop users
* Support a localized interface, starting with English and Hebrew (RTL), and provide a language picker (UI only, not the content submitted by users)
* Data model should not be country specific, i.e. it should support addresses/locations, etc. from multiple countries (e.g. US, England, Israel)
* Support search engine indexing
* Memorial page URLs should be friendly and sharable (i.e. slug with ID and name)
* Technology stack:
 * Next.js and TS for website (NextAuth for authentication)
 * Postgres for DB (AWS RDS for production)
 * ASW S3 for image storage (including presigned direct uploads and signed URLs for display); image optimization/thumbnail handling will be done in a future version. 
 * AWS SES for email sending
* Memorial pages load in < 2 seconds
* Site should be built to be cloud deployed (sensitive data in environment, etc.)