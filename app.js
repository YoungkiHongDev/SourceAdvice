const mongoose = require('mongoose');
const express = require('express');
const app = express();
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const moment = require('moment');
mongoose.connect('mongodb://localhost:27017/hunsu');
const db = mongoose.connection;
const autoIncrement = require('mongoose-auto-increment');



// DB 커넥트 성공 여부
db.once('err', () => {
    console.log(err);
});

db.once('open', () => {
    console.log('DB connected');
});

// User 스키마
const UserSchema = mongoose.Schema({
    user_id: String,
    password: String,
    name: String,
    email: String,
    address: String,
});
const User = mongoose.model('users', UserSchema);

// Advice 스키마
const AdviceSchema = mongoose.Schema({
    content_line    : { type : Number },
    user_id         : { type : String },
    advice          : { type : String } 
});
const Advice = mongoose.model('advice', AdviceSchema);

// Post 스키마
// 게시글을 보여줄 때 한줄씩 끊어서 보여주기 위해서 content는 배열로 지정함
const PostSchema = mongoose.Schema({
    post_no             : { type: Number },
    user_id             : { type: String },
    post_title          : { type: String },
    post_kategorie      : { type: String },
    post_content        : { type: Array },
    date                : { type: String },
    code_advice         : { type: [AdviceSchema] },
    viewcnt             : { type: Number } ///조회수 필드
});
autoIncrement.initialize(db);
PostSchema.plugin(autoIncrement.plugin,{ 
    model : 'posts', 
    field : 'post_no',
    startAt : 1, //시작
    increment : 1 // 증가 
});
const Post = mongoose.model('posts', PostSchema);



//이것저것 설정
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static(__dirname + '/css'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: "mongodb://localhost:27017"
})}));

let page_state = 0;  //페이지 중앙에 어떤 콘텐츠를 보여줄지 결정하기 위한 변수이며 이 변수를 이용하여 중앙의 컨텐츠를 바꾼다.
var idx = 0;
var limit_page = 0;
var page_kategorie = "";
var posts;
var max_page = 0;
var password_update = 0
var userinfo_update = 0


// 메인 페이지
app.get('/', async (req, res) => {
    if (req.session.logined) {
        // Post 보기
        if (page_state == 2) {
            var post = await Post.find({}).exec();
            var selected_post
            for(let j = 0; j < post.length; j++){
                if(post[j].post_no == idx){
                    post_no = post[j].post_no;
                    viewcnt = post[j].viewcnt;
                    selected_post = post[j];
                }
            }

            ///게시글 클릭 시 조회수 증가
            ///게시글을 클릭하여 페이지상태값이 2가 될 경우
            ///updateOne문, post_no를 통해 조회수값 viewcnt를 찾아서 +1
            Post.updateOne({ "post_no":post_no }, 
                {$set: { viewcnt:viewcnt+1 }},
                (err, post) => {
                if (err) return res.json(err);
                console.log('Success');
            })

            res.render('main', {
                id : req.session.user_id,
                post : selected_post,
                page_state : page_state,
            })
        } 
        // MyPage
        else if (page_state == 6){
            var user = await User.findOne({ "user_id" : req.session.user_id })
            
            posts = await Post.find({"user_id" : user.user_id}).sort({post_no: -1})

            if ((posts.length % 5) == 0) {
                limit_page = parseInt(posts.length / 5);
                max_page = parseInt(posts.length / 5);
            } else {
                limit_page = parseInt((posts.length / 5) + 1);
                max_page = parseInt((posts.length / 5) + 1);
            }
            res.render('main', {
                id                  : req.session.user_id,
                user                : user,
                posts               : posts,
                page_state          : page_state,
                limit_page          : limit_page,
                password_update     : password_update,
                userinfo_update     : userinfo_update
            })
            userinfo_update = 0
            password_update = 0
        } 
        // 그 외
        else{
            // 페이지 리스트
            if(page_state == 0){
                posts = await Post.find({})
                                      .sort({post_no: -1})
            } else{
                posts = await Post.find({"post_kategorie" : page_kategorie})
                                      .sort({post_no: -1})
            }

            if ((posts.length % 10) == 0) {
                limit_page = parseInt(posts.length / 10);
                max_page = parseInt(posts.length / 10);
            } else {
                limit_page = parseInt((posts.length / 10) + 1);
                max_page = parseInt((posts.length / 10) + 1);
            }

            res.render('main', {
                id          : req.session.user_id,
                posts       : posts,
                page_state  : page_state,    //페이지 상태
                limit_page    : limit_page,
            });
        };
    } else {
        res.render('login');
    }
});

// 페이징
app.get('/page/:page', async (req,res,next) => {
    var page = req.params.page;
    var sub_posts

    if(page == 999)
        page = max_page

    // All 리스트
    if(page_state == 0){
        sub_posts = await Post.find({})
                              .sort({post_no: -1})
                              .skip((page - 1) * 10)
    }
    //MyPage
    else if(page_state == 6){
        sub_posts = await Post.find({"user_id" : req.session.user_id})
                              .sort({post_no: -1})
                              .skip((page - 1) * 5)
    }
    //C, JAVA, Python
    else{
        sub_posts = await Post.find({"post_kategorie" : page_kategorie})
                              .sort({post_no: -1})
                              .skip((page - 1) * 10)
    }

    if (page_state == 6){
        var user = await User.findOne({ "user_id" : req.session.user_id })
        res.render('main', {
            id            : req.session.user_id,
            user          : user,
            posts         : sub_posts,
            page_state    : page_state,
            limit_page    : limit_page,
        });
    }
    else{
        res.render('main', {
            id          : req.session.user_id,
            posts       : sub_posts,
            page_state  : page_state,
            limit_page    : limit_page,
        });
    }

});

//회원가입
app.post('/register', (req, res) => {
    var uid = req.body.user_id;
    var upwd = req.body.password;
    var uname = req.body.name;
    var uemail = req.body.email;
    var uaddress = req.body.address;
    var result;

    User.findOne({ "user_id": uid }, (err, user) => {
        if (err) return res.json(err);
        if (!user) {
            User.create({ "user_id": uid, "password": upwd, "name": uname, "email": uemail, "address": uaddress }, (err) => {
                if (err) return res.json(err);
                ///회원가입 성공 시 result는 true
                res.render('registerResult', {
                    result: true
                });
            })
        } else {
            ///회원가입 실패 시 result는 false
            res.render('registerResult', {
                result: false
            });
        }
    })
});

//아이디 찾기
app.post('/findIDRst', (req, res) => {
    var uname = req.body.name;
    var uemail = req.body.email;
    var uaddress = req.body.address;
    User.findOne({ "name": uname, "email": uemail, "address": uaddress }, (err, user) => {
        if (err) return res.json(err);
        if (user) {
            ///아이디 찾기 성공 시 Findid에 찾은 아이디 저장
            res.render('findIDResult', {
                Findid: user.user_id
            });
        } else {
            ///아이디 찾기 실패 시 Findid에 null 저장
            res.render('findIDResult', {
                Findid: null
            });
        }
    })
})

//비밀번호 찾기
app.post('/findPasswordRst', (req, res) => {
    var uid = req.body.user_id;
    var uname = req.body.name;
    var uemail = req.body.email;
    var uaddress = req.body.address;

    User.findOne({ "user_id": uid, "name": uname, "email": uemail, "address": uaddress }, (err, user) => {
        if (err) return res.json(err);
        if (user) {
            ///비밀번호 찾기 성공 시 passwordid에 찾은 비밀번호 저장
            res.render('findPasswordResult', {
                passwordid: user.password
            });
        } else {
            ///비밀번호 찾기 실패 시 passwordid에 null 저장
            res.render('findPasswordResult', {
                passwordid: null
            });
        }
    })
})

//게시글 작성
app.post('/uploadPost', (req, res) => {
    var user_id = req.session.user_id;
    var post_title = req.body.post_title;
    var post_kategorie = req.body.post_kategorie;
    var post_content = req.body.post_content;
    var content = post_content.split(/\r\n|\r\n/);
    var date = moment().format("YYYY-MM-DD HH:mm:ss");

    Post.findOne({})
        .sort({post_no: -1})
        .exec( (err, post) =>{
            if (err) return res.json(err);
            Post.create({ "user_id": user_id, "post_title": post_title, "post_kategorie": post_kategorie,
                        "post_content": content, "date": date, "viewcnt": 0 }, (err) => {
                if (err) return res.json(err);
                console.log('Success');
                page_state = 0;
                res.redirect('/');
            });
    });
});

// 게시글 삭제
app.get('/deletePost/:delete_post_no', (req, res) => {
    var delete_post_no = req.params.delete_post_no;
    console.log(delete_post_no)
    Post.deleteOne({ "post_no" : delete_post_no }, (err, result) => {
        if (err) {
          console.log(err)
        } else {
            console.log(result);
            page_state = 0;
            res.redirect('/');
        }
    });
})

//로고 및 목록 클릭시 홈 화면으로 가기
app.get('/BackHome', (req, res) => {
    page_state = 0;
    res.redirect('/');
})

//로그아웃 버튼 클릭
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

//회원가입 버튼 클릭
app.post('/regist', (req, res) => {
    res.render('register', );
})

//아이디 찾기 버튼 클릭
app.post('/findID', (req, res) => {
    res.render('findID');
})

//비밀번호 찾기 버튼 클릭
app.post('/findpwd', (req, res) => {
    res.render('findPassword');
})

//뒤로가기 버튼 클릭
app.post('/BackHome', (req, res) => {
    page_state = 0;
    res.redirect('/');
})

//게시글 작성 버튼 클릭
app.post('/writePost_btn', (req, res) => {
    page_state = 1;
    res.redirect('/');
})

//게시글을 보기위해 제목을 클릭했을 때
app.get('/read/:post_no',(req,res,next) => {
    page_state = 2;
    idx = req.params.post_no;

    res.redirect('/');
});

//로그인 버튼 클릭
app.post('/', (req, res) => {
    let id = req.body.user_id;
    let pwd = req.body.password;
    duplicate(req, res, id, pwd);
});

// 서버 실행
app.listen(3000, () => {
    console.log('listening 3000port');
});

//로그인 시 동작될 함수
function duplicate(req, res, uid, upwd) {
    User.findOne({ "user_id": uid }, (err, user) => {
        if (err) return res.json(err);

        if (!user) {
            console.log('Cannot find user');
            res.send(`
                    <a href="/">Back</a>
                    <h1>rechecking your ID -Can't find user</h1>
                `);
        } else {
            User.findOne({ "password": upwd })
                .exec((err, user) => {
                    if (err) return res.json(err);

                    if (!user) {
                        console.log('login failed');
                        res.send('<a href="/">Back</a><h1>Login failed - different password</h1>');
                    } else {
                        console.log('welcome');
                        req.session.user_id = uid;
                        req.session.logined = true;
                        res.redirect('/');
                    }
                })
        }
    });
}

//C 메뉴 클릭 시
///페이지 상태값 3
app.get('/board_c', (req, res) => {
    page_state = 3;
    page_kategorie = "C";
    res.redirect('/');
});

//Java 메뉴 클릭 시
///페이지 상태값 4
app.get('/board_java', (req, res) => {
    page_state = 4;
    page_kategorie = "Java"
    res.redirect('/');
});

//Python 메뉴 클릭 시
///페이지 상태값 5
app.get('/board_python', (req, res) => {
    page_state = 5;
    page_kategorie = "Python"
    res.redirect('/');
});

//MyPage 메뉴 클릭 시
///페이지 상태값 6
app.get('/board_userinfo', (req, res) => {
    page_state = 6;
    res.redirect('/');
});

// 비밀번호 변경
app.post('/edit_password', async (req, res) => {
    var first = req.body.editPW_first;
    var second = req.body.editPW_second;

    if (first == second) {
        User.updateOne({"user_id" : req.session.user_id}, {"password" : first}, (err, user) =>{
            if (err) return res.json(err);

            console.log('password update success');
            password_update = 1
            res.redirect('/');
        })
    }
})

///MyPage에서 회원정보 수정 버튼 클릭 시
///유저의 이름, 이메일, 주소 정보 업데이트
app.post('/user_update', (req, res) => {
    var id = req.session.user_id;   ///현재 접속중인 유저 아이디
    var name = req.body.name;       ///유저의 이름
    var email = req.body.email;     ///유저의 이메일
    var address = req.body.address; ///유저의 주소

    ///update문, 유저 아이디로 이름, 이메일, 주소를 찾아서 업데이트
    User.update({ "user_id": id },
        {$set: { name:name, email:email, address:address}}, {multi:true},
        (err, user) => {
        if (err) return res.json(err);
        console.log('userinfo update Success');
        userinfo_update = 1
        res.redirect('/');
    })
});

// 훈수 추가
app.post('/write_advice', async (req, res) => {
    var input_user_id = req.session.user_id;
    var input_advice = req.body.advice;
    var input_line = req.body.line * 1;
    var search_number = req.body.post_no;

    Post.findOne({ "post_no" : search_number })
        .exec( (err, post) =>{
            if (err) return res.json(err);

            post.code_advice.push(new Advice({
                content_line : input_line,
                user_id : input_user_id,
                advice : input_advice
            }))
            post.save(function(err){
                if(!err)
                    console.log('advice saved!')
            })
            console.log('Success');
            res.redirect('/');
    });
});

// 훈수 보기
app.post('/read_advice', (req, res) => {
    var search_number = req.body.post_no;
    var line = req.body.line;
    var make_table_string = "";

    Post.findOne({ "post_no" : search_number })
        .exec( (err, post) =>{
            if (err) return res.json(err);

            if ( post.code_advice.length == 0 ) {
                make_table_string = "해당 Line에는 Advice가 없습니다!"
            }
            else {
                make_table_string = "<table class='table'><thead>" +
                                        "<tr>" +
                                            "<th scope='col' col width='20%'>ID</th>" +
                                            "<th scope='col' col width='80%'>Advice</th>" +
                                        "</tr>" +
                                    "</thead>" +
                                    "<tbody>";
                for (var i = 0 ; i < post.code_advice.length ; i++) {
                    if (post.code_advice[i].content_line == line){
                        make_table_string = make_table_string + "<tr>" +
                                                                    "<td>" + 
                                                                        post.code_advice[i].user_id +
                                                                    "</td>"+
                                                                    "<td>" + 
                                                                        post.code_advice[i].advice +
                                                                    "</td>"+
                                                                "</tr>"
                    }
                }
                make_table_string = make_table_string + "</tbody></table>"
            }

            

            res.send(make_table_string)

        });

});