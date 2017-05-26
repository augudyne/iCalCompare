<div id="table-of-contents">
<h2>Table of Contents</h2>
<div id="text-table-of-contents">
<ul>
<li><a href="#sec-1">1. iCalCompare</a>
<ul>
<li><a href="#sec-1-1">1.1. [27-Mar-2017] User Experience: I want a website portal where I can login to my account and have my own private dashboard</a></li>
<li><a href="#sec-1-2">1.2. [05-Apr-2017] User Experience: When I register with a username, don't make me type it again to login</a></li>
<li><a href="#sec-1-3">1.3. [03-May-2017] User Experience: Upload my course schedule (downloaded from UBC Courses) and have it saved on the site</a></li>
<li><a href="#sec-1-4">1.4. [15-May-2017] User Experience: Search for a friend, and send a friend request</a></li>
<li><a href="#sec-1-5">1.5. [15-May-2017] User Experience: Maintain a list of my friends</a></li>
</ul>
</li>
</ul>
</div>
</div>

# iCalCompare<a id="sec-1" name="sec-1"></a>

## [27-Mar-2017] User Experience: I want a website portal where I can login to my account and have my own private dashboard<a id="sec-1-1" name="sec-1-1"></a>

-   Routing for / to login page, use Jade HTML formatter to render the login page
-   mySQL back-end for user lookup. Use the built-in Node.JS cryptography library to hash and salt the password
-   If the user is not found, display a register button, leading to /register page
-   When login is succesful, create a **session cookie** for the user, lasting 30 minutes.

## [05-Apr-2017] User Experience: When I register with a username, don't make me type it again to login<a id="sec-1-2" name="sec-1-2"></a>

-   login page Jade Template has optional field 'carryOverUsername' that automatically sets username text for loginon succesful registration.

## [03-May-2017] User Experience: Upload my course schedule (downloaded from UBC Courses) and have it saved on the site<a id="sec-1-3" name="sec-1-3"></a>

-   leverage the iCal2JSON libary by adrianlee44 to parse the data from the iCal uploaded
-   use multer parser to allow POST requests with multi-part files
-   reduce the schedule into a 48-bit string of availability (do not truncate into int)
-   store availability in SQL table associated by userID

## [15-May-2017] User Experience: Search for a friend, and send a friend request<a id="sec-1-4" name="sec-1-4"></a>

-   Flexbox in HTML jade and main.css
-   Search for user in the search box
    -   If user found, display a div element with the username, and a button to send friend request
    -   If not found, display error message
-   Store the friend request in SQL table. If reciprocal friendship request exists, immediate confirm the friendship

## [15-May-2017] User Experience: Maintain a list of my friends<a id="sec-1-5" name="sec-1-5"></a>

-   Confirm friendship function, remove the friend requests and add tuple[min(sourceID, destID), max(sourceID,destID)]

to the friendhsip table
-   When a user logs in, fetch all friendships involving the user and display them on the dashboard